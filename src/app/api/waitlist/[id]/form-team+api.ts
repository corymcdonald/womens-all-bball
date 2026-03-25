import { publishEvent } from "@/lib/ably";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getWaitingQueue, transitionStatus } from "@/lib/waitlist";

const DEFAULT_COLORS = ["White", "Blue"] as const;

export async function POST(request: Request, { id }: { id: string }) {
  await requireAdmin(request);

  const queue = await getWaitingQueue(id);

  if (queue.length < 5) {
    return Response.json(
      { error: `Not enough players. Need 5, have ${queue.length}` },
      { status: 400 },
    );
  }

  const nextFive = queue.slice(0, 5);

  // Collect all colors currently in use:
  // 1. Teams in active games for this waitlist
  const { data: activeGames } = await supabase
    .from("games")
    .select(
      "team1:teams!games_team1_id_fkey(color), team2:teams!games_team2_id_fkey(color)",
    )
    .eq("waitlist_id", id)
    .eq("status", "in_progress");

  const usedColors = new Set<string>();
  for (const g of activeGames ?? []) {
    if ((g as any).team1?.color) usedColors.add((g as any).team1.color);
    if ((g as any).team2?.color) usedColors.add((g as any).team2.color);
  }

  // 2. Staged teams: players with "playing" status who aren't in an active game
  const activeTeamIds = new Set<string>();
  const { data: activeGamesFull } = await supabase
    .from("games")
    .select("team1_id, team2_id")
    .eq("waitlist_id", id)
    .eq("status", "in_progress");

  for (const g of activeGamesFull ?? []) {
    activeTeamIds.add(g.team1_id);
    activeTeamIds.add(g.team2_id);
  }

  const { data: playingPlayers } = await supabase
    .from("waitlist_players")
    .select("user_id")
    .eq("waitlist_id", id)
    .eq("status", "playing");

  if (playingPlayers && playingPlayers.length > 0) {
    // Find which teams these players are on
    const { data: tps } = await supabase
      .from("team_players")
      .select("team_id, teams(color)")
      .in(
        "user_id",
        playingPlayers.map((p) => p.user_id),
      );

    // Only count colors from teams NOT in an active game (those are staged)
    const seenTeams = new Set<string>();
    for (const tp of tps ?? []) {
      if (!activeTeamIds.has(tp.team_id) && !seenTeams.has(tp.team_id)) {
        seenTeams.add(tp.team_id);
        const color = (tp.teams as any)?.color;
        if (color) usedColors.add(color);
      }
    }
  }

  const availableColor =
    DEFAULT_COLORS.find((c) => !usedColors.has(c)) ?? DEFAULT_COLORS[0];

  // Create team
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({ color: availableColor })
    .select()
    .single();

  if (teamError || !team) {
    return Response.json({ error: "Failed to create team" }, { status: 500 });
  }

  // Add players to team and mark them as playing
  await supabase.from("team_players").insert(
    nextFive.map((wp) => ({
      team_id: team.id,
      user_id: wp.user_id,
    })),
  );

  for (const wp of nextFive) {
    await transitionStatus(wp.id, "waiting", "playing");
  }

  await publishEvent(`waitlist:${id}`, "updated");

  return Response.json({
    team,
    players: nextFive.map((wp) => ({
      waitlist_player_id: wp.id,
      user_id: wp.user_id,
      user: wp.users,
    })),
  });
}
