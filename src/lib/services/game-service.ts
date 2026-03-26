import { supabase } from "@/lib/supabase";
import { ServiceError } from "./service-error";
import { getStreak } from "./streak";
import { TEAM_SIZE, transitionTeamStatus } from "./team-service";

/**
 * Create a game by snapshotting the waitlist's current settings.
 */
export async function createGame(
  waitlistId: string,
  team1Id: string,
  team2Id: string,
) {
  const { data: waitlist } = await supabase
    .from("waitlists")
    .select("max_wins, game_duration_minutes")
    .eq("id", waitlistId)
    .single();

  if (!waitlist) {
    throw new ServiceError("Waitlist not found", 404);
  }

  const { data, error } = await supabase
    .from("games")
    .insert({
      waitlist_id: waitlistId,
      team1_id: team1Id,
      team2_id: team2Id,
      status: "in_progress",
      max_wins: waitlist.max_wins,
      game_duration_minutes: waitlist.game_duration_minutes,
    })
    .select()
    .single();

  if (error) {
    throw new ServiceError(error.message, 500);
  }

  return data;
}

/**
 * Mark all players on a team as "completed" in waitlist_players.
 * Uses a batch update instead of individual transitions.
 */
export async function markTeamPlayersCompleted(
  waitlistId: string,
  teamId: string,
) {
  const { data: players } = await supabase
    .from("team_players")
    .select("user_id")
    .eq("team_id", teamId);

  if (!players?.length) return;

  const userIds = players.map((tp) => tp.user_id);

  await supabase
    .from("waitlist_players")
    .update({ status: "completed" })
    .eq("waitlist_id", waitlistId)
    .in("user_id", userIds)
    .eq("status", "playing");
}

export type DeclareWinnerResult = {
  gameId: string;
  waitlistId: string;
  winnerId: string;
  loserId: string;
  streak: number;
  streakMaxed: boolean;
  stayingTeamId: string | null;
  playersNeeded: number;
};

/**
 * Rotate teams after a game: loser completes, winner either stages or completes.
 * Returns the staying team ID (null if both rotate off).
 */
async function rotateTeams(
  waitlistId: string,
  winnerId: string,
  loserId: string,
  streakMaxed: boolean,
): Promise<string | null> {
  await transitionTeamStatus(loserId, "completed");
  await markTeamPlayersCompleted(waitlistId, loserId);

  if (streakMaxed) {
    await transitionTeamStatus(winnerId, "completed");
    await markTeamPlayersCompleted(waitlistId, winnerId);
    return null;
  }

  await transitionTeamStatus(winnerId, "staged");
  return winnerId;
}

/**
 * Declare a winner: validate, update game, compute streak, rotate teams.
 */
export async function declareWinner(
  gameId: string,
  winnerTeamId: string,
): Promise<DeclareWinnerResult> {
  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .eq("status", "in_progress")
    .single();

  if (!game) {
    throw new ServiceError("Active game not found", 404);
  }

  if (winnerTeamId !== game.team1_id && winnerTeamId !== game.team2_id) {
    throw new ServiceError("winner_id must be one of the game's teams", 400);
  }

  const { error: updateError } = await supabase
    .from("games")
    .update({ status: "completed", winner_id: winnerTeamId })
    .eq("id", gameId);

  if (updateError) {
    throw new ServiceError(updateError.message, 500);
  }

  const losingTeamId =
    winnerTeamId === game.team1_id ? game.team2_id : game.team1_id;

  const { streak } = await getStreak(game.waitlist_id);
  const streakMaxed = streak >= game.max_wins;

  const stayingTeamId = await rotateTeams(
    game.waitlist_id,
    winnerTeamId,
    losingTeamId,
    streakMaxed,
  );

  return {
    gameId,
    waitlistId: game.waitlist_id,
    winnerId: winnerTeamId,
    loserId: losingTeamId,
    streak,
    streakMaxed,
    stayingTeamId,
    playersNeeded: streakMaxed ? TEAM_SIZE * 2 : TEAM_SIZE,
  };
}
