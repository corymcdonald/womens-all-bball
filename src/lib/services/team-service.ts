import { supabase } from "@/lib/supabase";
import { getWaitingQueue, transitionStatus } from "@/lib/waitlist";
import { ServiceError } from "./service-error";

export const TEAM_SIZE = 5;
export const DEFAULT_COLORS = ["White", "Blue"] as const;

/**
 * Get staged teams for a waitlist (status = 'staged').
 */
export async function getStagedTeams(waitlistId: string) {
  const { data, error } = await supabase
    .from("teams")
    .select("id, color, created_at")
    .eq("waitlist_id", waitlistId)
    .eq("status", "staged")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Get colors currently in use by staged or playing teams for a waitlist.
 */
export async function getUsedColors(waitlistId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("teams")
    .select("color")
    .eq("waitlist_id", waitlistId)
    .in("status", ["staged", "playing"]);

  return new Set((data ?? []).map((t) => t.color));
}

/**
 * Form a team from the top 5 waiting players in the queue.
 * Creates team with status 'staged', picks color avoiding used colors.
 */
export async function formTeamFromQueue(
  waitlistId: string,
  excludeColors?: string[],
) {
  const queue = await getWaitingQueue(waitlistId);
  const waitingOnly = queue.filter((p) => p.status === "waiting");

  if (waitingOnly.length < TEAM_SIZE) {
    return null;
  }

  const nextFive = waitingOnly.slice(0, TEAM_SIZE);

  const excluded = new Set(excludeColors ?? []);
  const color =
    DEFAULT_COLORS.find((c) => !excluded.has(c)) ?? DEFAULT_COLORS[0];

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({ color, waitlist_id: waitlistId, status: "staged" })
    .select()
    .single();

  if (teamError || !team) {
    throw new ServiceError("Failed to create team", 500);
  }

  await supabase.from("team_players").insert(
    nextFive.map((wp) => ({
      team_id: team.id,
      user_id: wp.user_id,
    })),
  );

  for (const wp of nextFive) {
    await transitionStatus(wp.id, "waiting", "playing");
  }

  return {
    team,
    players: nextFive.map((wp) => ({
      waitlist_player_id: wp.id,
      user_id: wp.user_id,
      user: wp.users,
    })),
  };
}

/**
 * Transition a team's status.
 */
export async function transitionTeamStatus(
  teamId: string,
  newStatus: "staged" | "playing" | "completed",
) {
  const { error } = await supabase
    .from("teams")
    .update({ status: newStatus })
    .eq("id", teamId);

  if (error) throw error;
}
