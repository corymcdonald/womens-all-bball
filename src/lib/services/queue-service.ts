import { supabase } from "@/lib/supabase";
import {
  hasActiveRow,
  transitionStatus,
  getNextWaitingPlayer,
} from "@/lib/waitlist";
import { ServiceError } from "./service-error";

/**
 * Swap a player on a team with an optional replacement from the queue.
 * The removed player returns to the queue (playing → waiting).
 */
export async function swapPlayerOnTeam(
  waitlistId: string,
  teamId: string,
  userId: string,
  replacementUserId?: string,
) {
  // Verify team belongs to this waitlist and is active
  const { data: team } = await supabase
    .from("teams")
    .select("id, status")
    .eq("id", teamId)
    .eq("waitlist_id", waitlistId)
    .single();

  if (!team) {
    throw new ServiceError("Team not found", 404);
  }
  if (team.status !== "staged" && team.status !== "playing") {
    throw new ServiceError("Can only swap players on active teams", 400);
  }

  // Verify user is on the team
  const { data: teamPlayer } = await supabase
    .from("team_players")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();

  if (!teamPlayer) {
    throw new ServiceError("Player is not on this team", 404);
  }

  // Find their waitlist_players row
  const { data: wpRow } = await supabase
    .from("waitlist_players")
    .select("id, status")
    .eq("waitlist_id", waitlistId)
    .eq("user_id", userId)
    .eq("status", "playing")
    .single();

  if (!wpRow) {
    throw new ServiceError("Player waitlist row not found", 404);
  }

  // Find replacement BEFORE removing the player, so they can't be
  // selected as their own replacement after transitioning to "waiting".
  let replacement = null;
  const replaceUserId = replacementUserId
    ?? (await getNextWaitingPlayer(waitlistId))?.user_id;

  // Remove from team
  await supabase
    .from("team_players")
    .delete()
    .eq("id", teamPlayer.id);

  // Return to queue (playing → waiting)
  const removed = await transitionStatus(wpRow.id, "playing", "waiting");

  // Pull replacement onto the team
  if (replaceUserId) {
    const { data: replacementWp } = await supabase
      .from("waitlist_players")
      .select("id, status")
      .eq("waitlist_id", waitlistId)
      .eq("user_id", replaceUserId)
      .eq("status", "waiting")
      .single();

    if (replacementWp) {
      replacement = await transitionStatus(
        replacementWp.id,
        "waiting",
        "playing",
      );
      await supabase.from("team_players").insert({
        team_id: teamId,
        user_id: replaceUserId,
      });
    } else if (replacementUserId) {
      // Only error if the caller explicitly asked for this player
      throw new ServiceError("Replacement player is not in the queue", 400);
    }
  }

  return { removed, replacement };
}

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
 * Pull the next waiting player onto a team as a replacement.
 */
async function swapReplacement(waitlistId: string, teamId: string) {
  const nextPlayer = await getNextWaitingPlayer(waitlistId);
  if (!nextPlayer) return null;

  const replacement = await transitionStatus(
    nextPlayer.id,
    "waiting",
    "playing",
  );
  await supabase.from("team_players").insert({
    team_id: teamId,
    user_id: nextPlayer.user_id,
  });
  return replacement;
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

  const shouldReplace =
    (targetStatus === "absent" && player.status === "waiting" && teamId) ||
    (targetStatus === "left" && player.status === "playing" && teamId);

  const replacement = shouldReplace
    ? await swapReplacement(waitlistId, teamId!)
    : null;

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
