import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { transitionStatus } from "@/lib/waitlist";
import { publishEvent } from "@/lib/ably";

async function markTeamPlayersCompleted(waitlistId: string, teamId: string) {
  const { data: players } = await supabase
    .from("team_players")
    .select("user_id")
    .eq("team_id", teamId);

  for (const tp of players ?? []) {
    const { data: wp } = await supabase
      .from("waitlist_players")
      .select("id, status")
      .eq("waitlist_id", waitlistId)
      .eq("user_id", tp.user_id)
      .eq("status", "playing")
      .single();

    if (wp) {
      await transitionStatus(wp.id, "playing", "completed");
    }
  }
}

export async function POST(request: Request, { id }: { id: string }) {
  await requireAdmin(request);

  const { winner_id } = await request.json();

  if (!winner_id) {
    return Response.json({ error: "winner_id is required" }, { status: 400 });
  }

  // Get the game
  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .eq("status", "in_progress")
    .single();

  if (!game) {
    return Response.json({ error: "Active game not found" }, { status: 404 });
  }

  if (winner_id !== game.team1_id && winner_id !== game.team2_id) {
    return Response.json(
      { error: "winner_id must be one of the game's teams" },
      { status: 400 },
    );
  }

  // Mark game as completed
  const { error: updateError } = await supabase
    .from("games")
    .update({ status: "completed", winner_id })
    .eq("id", id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  const losingTeamId =
    winner_id === game.team1_id ? game.team2_id : game.team1_id;

  // Get the waitlist to check streak
  const { data: waitlist } = await supabase
    .from("waitlists")
    .select("current_streak, max_wins")
    .eq("id", game.waitlist_id)
    .single();

  const currentStreak = (waitlist?.current_streak ?? 0) + 1;
  const maxWins = game.max_wins; // use the snapshotted value from the game
  const streakMaxed = currentStreak >= maxWins;

  if (streakMaxed) {
    // Both teams rotate off — mark all players as completed, reset streak
    await markTeamPlayersCompleted(game.waitlist_id, losingTeamId);
    await markTeamPlayersCompleted(game.waitlist_id, winner_id);

    await supabase
      .from("waitlists")
      .update({ current_streak: 0 })
      .eq("id", game.waitlist_id);
  } else {
    // Only losing team rotates — winning team stays, increment streak
    await markTeamPlayersCompleted(game.waitlist_id, losingTeamId);

    await supabase
      .from("waitlists")
      .update({ current_streak: currentStreak })
      .eq("id", game.waitlist_id);
  }

  await publishEvent(`waitlist:${game.waitlist_id}`, "game:completed", {
    game_id: id,
    winner_id,
    streak: currentStreak,
    streak_maxed: streakMaxed,
    players_needed: streakMaxed ? 10 : 5,
  });

  return Response.json({
    game_id: id,
    winner_id,
    losing_team_id: losingTeamId,
    streak: currentStreak,
    streak_maxed: streakMaxed,
    players_needed: streakMaxed ? 10 : 5,
  });
}
