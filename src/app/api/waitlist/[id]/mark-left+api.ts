import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { transitionStatus, getNextWaitingPlayer } from "@/lib/waitlist";
import { publishEvent } from "@/lib/ably";

export async function POST(request: Request, { id }: { id: string }) {
  await requireAdmin(request);

  const { waitlist_player_id, team_id } = await request.json();

  if (!waitlist_player_id) {
    return Response.json(
      { error: "waitlist_player_id is required" },
      { status: 400 },
    );
  }

  const { data: player } = await supabase
    .from("waitlist_players")
    .select("*")
    .eq("id", waitlist_player_id)
    .eq("waitlist_id", id)
    .single();

  if (!player) {
    return Response.json({ error: "Player not found" }, { status: 404 });
  }

  const leftPlayer = await transitionStatus(player.id, player.status, "left");

  // If the player was playing (injury, etc.) and was on a team, swap in replacement
  let replacement = null;
  if (player.status === "playing" && team_id) {
    const nextPlayer = await getNextWaitingPlayer(id);
    if (nextPlayer) {
      replacement = await transitionStatus(nextPlayer.id, "waiting", "playing");

      await supabase.from("team_players").insert({
        team_id,
        user_id: nextPlayer.user_id,
      });
    }
  }

  await publishEvent(`waitlist:${id}`, "updated");

  return Response.json({ leftPlayer, replacement });
}
