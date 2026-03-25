import { supabase } from "@/lib/supabase";
import { transitionStatus } from "@/lib/waitlist";
import { ServiceError } from "./service-error";
import { getStreak } from "./streak";
import { transitionTeamStatus } from "./team-service";

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
 */
export async function markTeamPlayersCompleted(
  waitlistId: string,
  teamId: string,
) {
  const { data: players } = await supabase
    .from("team_players")
    .select("user_id")
    .eq("team_id", teamId);

  for (const tp of players ?? []) {
    // Use .limit(1) instead of .single() to avoid errors on multiple rows
    const { data: wps } = await supabase
      .from("waitlist_players")
      .select("id, status")
      .eq("waitlist_id", waitlistId)
      .eq("user_id", tp.user_id)
      .eq("status", "playing")
      .limit(1);

    if (wps && wps.length > 0) {
      await transitionStatus(wps[0].id, "playing", "completed");
    }
  }
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
 * Declare a winner:
 *   1. Mark game as completed with winner
 *   2. Calculate streak (team1 = staying team, team2 = challenger)
 *   3. Loser team → status 'completed', players → 'completed'
 *   4. If streak maxed: winner team → 'completed', players → 'completed'
 *   5. If streak NOT maxed: winner team → 'staged' (stays on for next game)
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

  // Mark game as completed
  const { error: updateError } = await supabase
    .from("games")
    .update({ status: "completed", winner_id: winnerTeamId })
    .eq("id", gameId);

  if (updateError) {
    throw new ServiceError(updateError.message, 500);
  }

  const losingTeamId =
    winnerTeamId === game.team1_id ? game.team2_id : game.team1_id;

  // Compute streak from game history (this game is now completed)
  const { streak } = await getStreak(game.waitlist_id);
  const maxWins = game.max_wins;
  const streakMaxed = streak >= maxWins;

  // Loser always rotates off
  await transitionTeamStatus(losingTeamId, "completed");
  await markTeamPlayersCompleted(game.waitlist_id, losingTeamId);

  let stayingTeamId: string | null = null;

  if (streakMaxed) {
    await transitionTeamStatus(winnerTeamId, "completed");
    await markTeamPlayersCompleted(game.waitlist_id, winnerTeamId);
  } else {
    await transitionTeamStatus(winnerTeamId, "staged");
    stayingTeamId = winnerTeamId;
  }

  return {
    gameId,
    waitlistId: game.waitlist_id,
    winnerId: winnerTeamId,
    loserId: losingTeamId,
    streak,
    streakMaxed,
    stayingTeamId,
    playersNeeded: streakMaxed ? 10 : 5,
  };
}
