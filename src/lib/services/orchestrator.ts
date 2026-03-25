import { publishEvent } from "@/lib/ably";
import { supabase } from "@/lib/supabase";
import { getWaitingQueue } from "@/lib/waitlist";
import {
  createGame,
  declareWinner,
  type DeclareWinnerResult,
} from "./game-service";
import { withLock } from "./lock";
import { addToQueue } from "./queue-service";
import {
  formTeamFromQueue,
  getStagedTeams,
  getUsedColors,
  TEAM_SIZE,
  transitionTeamStatus,
} from "./team-service";

/**
 * Internal implementation — runs inside the lock.
 * Evaluates state and takes the single appropriate next action,
 * then recurses once if a team was formed (to check if we can now start a game).
 */
async function advance(waitlistId: string): Promise<void> {
  // If a game is in progress, nothing to do
  const { data: activeGames } = await supabase
    .from("games")
    .select("id")
    .eq("waitlist_id", waitlistId)
    .eq("status", "in_progress")
    .limit(1);

  if (activeGames && activeGames.length > 0) return;

  // Check staged teams
  const stagedTeams = await getStagedTeams(waitlistId);

  // 2 teams ready → start the game
  if (stagedTeams.length >= 2) {
    await transitionTeamStatus(stagedTeams[0].id, "playing");
    await transitionTeamStatus(stagedTeams[1].id, "playing");

    // Preserve the staying team's display position from the previous game.
    // Look up which position (team1=left, team2=right) the winner held,
    // and keep them in the same slot for the next game.
    const { data: prevGame } = await supabase
      .from("games")
      .select("team1_id, team2_id, winner_id")
      .eq("waitlist_id", waitlistId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let team1Id = stagedTeams[0].id;
    let team2Id = stagedTeams[1].id;

    if (prevGame?.winner_id) {
      // The staying team is the one that was in the previous game (winner)
      const stayingTeam = stagedTeams.find((t) => t.id === prevGame.winner_id);
      const challengerTeam = stagedTeams.find(
        (t) => t.id !== prevGame.winner_id,
      );

      if (stayingTeam && challengerTeam) {
        if (prevGame.winner_id === prevGame.team1_id) {
          // Winner was team1 (left) → stays left
          team1Id = stayingTeam.id;
          team2Id = challengerTeam.id;
        } else {
          // Winner was team2 (right) → stays right
          team1Id = challengerTeam.id;
          team2Id = stayingTeam.id;
        }
      }
    }

    const game = await createGame(waitlistId, team1Id, team2Id);
    await publishEvent(`waitlist:${waitlistId}`, "game:started", {
      game_id: game.id,
    });
    return;
  }

  // Not enough waiting players to form a team → done
  const queue = await getWaitingQueue(waitlistId);
  const waitingCount = queue.filter((p) => p.status === "waiting").length;
  if (waitingCount < TEAM_SIZE) return;

  // Form one team
  const usedColors = await getUsedColors(waitlistId);
  const result = await formTeamFromQueue(waitlistId, [...usedColors]);
  if (!result) return;

  await publishEvent(`waitlist:${waitlistId}`, "team:formed", {
    team_id: result.team.id,
  });

  // Re-evaluate: may now have 2 staged teams → start game
  await advance(waitlistId);
}

/**
 * Public entry point — acquires a DB lock per waitlist before running.
 * Concurrent callers for the same waitlist will wait (up to 5s) then proceed serially.
 */
export async function checkAndAdvance(waitlistId: string): Promise<void> {
  await withLock(`waitlist:${waitlistId}`, () => advance(waitlistId));
}

/**
 * Join a player to the queue, publish event, then check if auto-formation should happen.
 */
export async function joinAndAdvance(waitlistId: string, userId: string) {
  const player = await addToQueue(waitlistId, userId);
  await publishEvent(`waitlist:${waitlistId}`, "updated");
  await checkAndAdvance(waitlistId);
  return player;
}

/**
 * Declare a winner, publish events, then auto-form next game.
 */
export async function declareWinnerAndAdvance(
  gameId: string,
  winnerTeamId: string,
): Promise<DeclareWinnerResult> {
  const result = await declareWinner(gameId, winnerTeamId);

  await publishEvent(`waitlist:${result.waitlistId}`, "game:completed", {
    game_id: gameId,
    winner_id: winnerTeamId,
    streak: result.streak,
    streak_maxed: result.streakMaxed,
  });

  await checkAndAdvance(result.waitlistId);

  await publishEvent(`waitlist:${result.waitlistId}`, "updated");

  return result;
}
