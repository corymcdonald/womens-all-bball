import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { transitionStatus } from "@/lib/waitlist";
import { publishEvent } from "@/lib/ably";

export async function POST(request: Request, { id }: { id: string }) {
  const requesterId = getUserId(request);
  if (!requesterId) {
    return Response.json({ error: "Missing user ID" }, { status: 401 });
  }

  const { waitlist_player_id } = await request.json();

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

  // Allow if requester is the player themselves or an admin
  const { data: requester } = await supabase
    .from("users")
    .select("role")
    .eq("id", requesterId)
    .single();

  if (player.user_id !== requesterId && requester?.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const updated = await transitionStatus(player.id, player.status, "waiting");

  await publishEvent(`waitlist:${id}`, "updated");

  return Response.json(updated);
}
