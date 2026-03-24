import { supabase } from "@/lib/supabase";
import { getWaitingQueue } from "@/lib/waitlist";

export async function GET(request: Request, { id }: { id: string }) {
  // Get waitlist info
  const { data: waitlist, error: waitlistError } = await supabase
    .from("waitlists")
    .select("id, created_at, max_wins, game_duration_minutes, current_streak")
    .eq("id", id)
    .single();

  if (waitlistError || !waitlist) {
    return Response.json({ error: "Waitlist not found" }, { status: 404 });
  }

  // Get waiting queue (ordered)
  const queue = await getWaitingQueue(id);

  // Get currently playing players
  const { data: playing } = await supabase
    .from("waitlist_players")
    .select("*, users(id, first_name, last_name)")
    .eq("waitlist_id", id)
    .eq("status", "playing");

  // Get active game with teams
  const { data: activeGame } = await supabase
    .from("games")
    .select(
      `*,
      team1:teams!games_team1_id_fkey(id, color, team_players(user_id, users(id, first_name, last_name))),
      team2:teams!games_team2_id_fkey(id, color, team_players(user_id, users(id, first_name, last_name)))`,
    )
    .eq("waitlist_id", id)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1);

  // If the winning team has hit the streak limit, next rotation needs 10 players (both teams off).
  // Otherwise just 5 (only the challenger rotates).
  const streakMaxed =
    (waitlist as any).current_streak >= (waitlist as any).max_wins;
  const upNextCount = streakMaxed ? 10 : 5;

  return Response.json({
    waitlist,
    queue,
    playing: playing ?? [],
    activeGame: activeGame?.[0] ?? null,
    upNext: queue.slice(0, upNextCount),
    upNextCount,
  });
}
