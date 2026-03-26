import { publishEvent } from "@/lib/ably";
import { getUserId, isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { markPresent } from "@/lib/services/queue-service";
import { handleRouteError } from "@/lib/api-error";
import { posthogServer } from "@/lib/posthog-server";

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

  // Self-service: player can mark themselves present. Admin check uses JWT.
  const admin = await isAdmin(request);
  if (player.user_id !== requesterId && !admin) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const updated = await markPresent(id, waitlist_player_id);
    await publishEvent(`waitlist:${id}`, "updated");
    posthogServer?.capture({
      distinctId: requesterId,
      event: "player_marked_present",
      properties: {
        waitlist_id: id,
        waitlist_player_id,
        is_self: requesterId === player.user_id,
      },
    });
    return Response.json(updated);
  } catch (e) {
    return handleRouteError(e);
  }
}
