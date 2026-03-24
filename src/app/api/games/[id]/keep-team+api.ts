import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { getNextWaitingPlayer, transitionStatus } from "@/lib/waitlist";
import { publishEvent } from "@/lib/ably";

export async function POST(request: Request, { id }: { id: string }) {
  await requireAdmin(request);

  const { dropped_user_ids } = await request.json();

  // Get the completed game
  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .eq("status", "completed")
    .single();

  if (!game || !game.winner_id) {
    return Response.json(
      { error: "Completed game with winner not found" },
      { status: 404 },
    );
  }

  // Get winning team's players
  const { data: winningPlayers } = await supabase
    .from("team_players")
    .select("user_id")
    .eq("team_id", game.winner_id);

  if (!winningPlayers) {
    return Response.json(
      { error: "Could not find winning team players" },
      { status: 500 },
    );
  }

  const droppedSet = new Set(dropped_user_ids ?? []);
  const remainingUserIds = winningPlayers
    .map((tp) => tp.user_id)
    .filter((uid) => !droppedSet.has(uid));

  // Mark dropped players as completed
  for (const userId of droppedSet) {
    const { data: wp } = await supabase
      .from("waitlist_players")
      .select("id, status")
      .eq("waitlist_id", game.waitlist_id)
      .eq("user_id", userId)
      .eq("status", "playing")
      .single();

    if (wp) {
      await transitionStatus(wp.id, "playing", "completed");
    }
  }

  // If no players dropped, the existing team stays as-is
  if (droppedSet.size === 0) {
    return Response.json({
      team_id: game.winner_id,
      players: winningPlayers.map((tp) => tp.user_id),
      replacements: [],
    });
  }

  // Create a new team with remaining players + replacements from queue
  const { data: winningTeam } = await supabase
    .from("teams")
    .select("color")
    .eq("id", game.winner_id)
    .single();

  const { data: newTeam } = await supabase
    .from("teams")
    .insert({ color: winningTeam?.color ?? "Unknown" })
    .select()
    .single();

  if (!newTeam) {
    return Response.json(
      { error: "Failed to create replacement team" },
      { status: 500 },
    );
  }

  // Add remaining players to new team
  const teamPlayerInserts = remainingUserIds.map((uid) => ({
    team_id: newTeam.id,
    user_id: uid,
  }));

  // Fill dropped spots from queue
  const replacements = [];
  for (let i = 0; i < droppedSet.size; i++) {
    const nextPlayer = await getNextWaitingPlayer(game.waitlist_id);
    if (nextPlayer) {
      await transitionStatus(nextPlayer.id, "waiting", "playing");
      teamPlayerInserts.push({
        team_id: newTeam.id,
        user_id: nextPlayer.user_id,
      });
      replacements.push(nextPlayer);
    }
  }

  await supabase.from("team_players").insert(teamPlayerInserts);

  await publishEvent(`waitlist:${game.waitlist_id}`, "updated");

  return Response.json({
    team_id: newTeam.id,
    players: teamPlayerInserts.map((tp) => tp.user_id),
    replacements,
  });
}
