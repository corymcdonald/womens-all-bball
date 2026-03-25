import { supabase } from "@/lib/supabase";

/**
 * Compute the current win streak for a waitlist by counting consecutive
 * wins by the same team from the most recent completed games.
 *
 * Returns { streak, teamId } where teamId is the team on the streak,
 * or { streak: 0, teamId: null } if no games or no streak.
 */
export async function getStreak(
  waitlistId: string,
): Promise<{ streak: number; teamId: string | null }> {
  const { data: games } = await supabase
    .from("games")
    .select("winner_id")
    .eq("waitlist_id", waitlistId)
    .eq("status", "completed")
    .not("winner_id", "is", null)
    .order("created_at", { ascending: false });

  if (!games || games.length === 0) {
    return { streak: 0, teamId: null };
  }

  const lastWinner = games[0].winner_id;
  let streak = 0;

  for (const game of games) {
    if (game.winner_id === lastWinner) {
      streak++;
    } else {
      break;
    }
  }

  return { streak, teamId: lastWinner };
}
