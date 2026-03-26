import { ServiceError } from "./services/service-error";
import { supabase } from "./supabase";

// Valid state transitions for waitlist_players
const VALID_TRANSITIONS: Record<string, string[]> = {
  waiting: ["playing", "absent", "left"],
  absent: ["left", "waiting"],
  playing: ["completed", "left"],
};

export function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// Get the ordered queue for a waitlist (waiting + absent players)
export async function getWaitingQueue(waitlistId: string) {
  const { data, error } = await supabase
    .from("waitlist_players")
    .select("*, users(id, first_name, last_name, email)")
    .eq("waitlist_id", waitlistId)
    .in("status", ["waiting", "absent"])
    .order("priority", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

// Get the next waiting player (top of queue, excluding absent)
export async function getNextWaitingPlayer(waitlistId: string) {
  const { data, error } = await supabase
    .from("waitlist_players")
    .select("*, users(id, first_name, last_name, email)")
    .eq("waitlist_id", waitlistId)
    .eq("status", "waiting")
    .order("priority", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  return data[0] ?? null;
}

// Check if a user has an active row in a waitlist
export async function hasActiveRow(waitlistId: string, userId: string) {
  const { data, error } = await supabase
    .from("waitlist_players")
    .select("id, status")
    .eq("waitlist_id", waitlistId)
    .eq("user_id", userId)
    .in("status", ["waiting", "playing", "absent"])
    .limit(1);

  if (error) throw error;
  return data.length > 0 ? data[0] : null;
}

// Transition a waitlist player's status with validation
export async function transitionStatus(
  waitlistPlayerId: string,
  currentStatus: string,
  newStatus: string,
) {
  if (!canTransition(currentStatus, newStatus)) {
    throw new ServiceError(
      `Invalid transition: ${currentStatus} -> ${newStatus}`,
      400,
    );
  }

  const { data, error } = await supabase
    .from("waitlist_players")
    .update({ status: newStatus })
    .eq("id", waitlistPlayerId)
    .eq("status", currentStatus)
    .select()
    .single();

  if (error) throw error;
  return data;
}
