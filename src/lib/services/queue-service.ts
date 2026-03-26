import { supabase } from "@/lib/supabase";
import {
  hasActiveRow,
  transitionStatus,
  getNextWaitingPlayer,
} from "@/lib/waitlist";
import { ServiceError } from "./service-error";

/**
 * Add a user to a waitlist queue with status "waiting".
 * Shared by: join, join-token, add-player endpoints.
 * Handles the duplicate-key race condition gracefully.
 */
export async function addToQueue(waitlistId: string, userId: string) {
  const { data, error } = await supabase
    .from("waitlist_players")
    .insert({
      waitlist_id: waitlistId,
      user_id: userId,
      status: "waiting",
    })
    .select()
    .single();

  if (error) {
    // Race condition: unique constraint means they joined between check and insert
    if (error.code === "23505") {
      return { authorized: true, existing: true };
    }
    throw new ServiceError(error.message, 500);
  }

  return data;
}

/**
 * Transition a player's status and optionally swap a replacement onto their team.
 * Shared by: mark-absent, mark-left endpoints.
 */
export async function removeFromPlay(
  waitlistId: string,
  waitlistPlayerId: string,
  targetStatus: "absent" | "left",
  teamId?: string,
) {
  const { data: player } = await supabase
    .from("waitlist_players")
    .select("*")
    .eq("id", waitlistPlayerId)
    .eq("waitlist_id", waitlistId)
    .single();

  if (!player) {
    throw new ServiceError("Player not found", 404);
  }

  const transitioned = await transitionStatus(
    player.id,
    player.status,
    targetStatus,
  );

  // If the player was on a team and we have a teamId, swap in replacement
  let replacement = null;
  const shouldReplace =
    (targetStatus === "absent" && player.status === "waiting" && teamId) ||
    (targetStatus === "left" && player.status === "playing" && teamId);

  if (shouldReplace) {
    const nextPlayer = await getNextWaitingPlayer(waitlistId);
    if (nextPlayer) {
      replacement = await transitionStatus(nextPlayer.id, "waiting", "playing");
      await supabase.from("team_players").insert({
        team_id: teamId,
        user_id: nextPlayer.user_id,
      });
    }
  }

  return { transitioned, replacement };
}

/**
 * Self-serve leave: player leaves the queue (waiting/absent → left).
 */
export async function leaveQueue(waitlistId: string, userId: string) {
  const activeRow = await hasActiveRow(waitlistId, userId);
  if (!activeRow) {
    throw new ServiceError("Not currently in the waitlist", 404);
  }

  if (activeRow.status !== "waiting" && activeRow.status !== "absent") {
    throw new ServiceError(
      `Cannot leave while status is: ${activeRow.status}`,
      400,
    );
  }

  return transitionStatus(activeRow.id, activeRow.status, "left");
}

/**
 * Mark an absent player as present (absent → waiting).
 */
export async function markPresent(
  waitlistId: string,
  waitlistPlayerId: string,
) {
  const { data: player } = await supabase
    .from("waitlist_players")
    .select("*")
    .eq("id", waitlistPlayerId)
    .eq("waitlist_id", waitlistId)
    .single();

  if (!player) {
    throw new ServiceError("Player not found", 404);
  }

  return transitionStatus(player.id, player.status, "waiting");
}
