import { publishEvent } from "@/lib/ably";
import { getUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { markPresent } from "@/lib/services/queue-service";
import { ServiceError } from "@/lib/services/service-error";

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

  // Check the player exists and requester is authorized (self or admin)
  const { data: player } = await supabase
    .from("waitlist_players")
    .select("user_id")
    .eq("id", waitlist_player_id)
    .eq("waitlist_id", id)
    .single();

  if (!player) {
    return Response.json({ error: "Player not found" }, { status: 404 });
  }

  const { data: requester } = await supabase
    .from("users")
    .select("role")
    .eq("id", requesterId)
    .single();

  if (player.user_id !== requesterId && requester?.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const updated = await markPresent(id, waitlist_player_id);
    await publishEvent(`waitlist:${id}`, "updated");
    return Response.json(updated);
  } catch (e) {
    if (e instanceof ServiceError) {
      return Response.json({ error: e.message }, { status: e.statusCode });
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
