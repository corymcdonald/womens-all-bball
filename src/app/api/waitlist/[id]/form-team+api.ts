import { publishEvent } from "@/lib/ably";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getWaitingQueue, transitionStatus } from "@/lib/waitlist";

// Colors that can be assigned to teams
const TEAM_COLORS = [
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Purple",
  "Orange",
  "Pink",
  "White",
  "Black",
  "Gray",
];

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

  // Pick a color not currently in use by an active game
  const { data: activeGames } = await supabase
    .from("games")
    .select(
      "team1:teams!games_team1_id_fkey(color), team2:teams!games_team2_id_fkey(color)",
    )
    .eq("waitlist_id", id)
    .eq("status", "in_progress");

  const usedColors = new Set(
    (activeGames ?? []).flatMap((g: any) => [g.team1?.color, g.team2?.color]),
  );

  const availableColor =
    TEAM_COLORS.find((c) => !usedColors.has(c)) ?? TEAM_COLORS[0];

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
  const teamPlayerInserts = nextFive.map((wp) => ({
    team_id: team.id,
    user_id: wp.user_id,
  }));

  await supabase.from("team_players").insert(teamPlayerInserts);

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
