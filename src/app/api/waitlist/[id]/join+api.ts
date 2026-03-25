import { getUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { hasActiveRow } from "@/lib/waitlist";
import { joinAndAdvance } from "@/lib/services/orchestrator";
import { ServiceError } from "@/lib/services/service-error";
import { posthogServer } from "@/lib/posthog-server";

export async function POST(request: Request, { id }: { id: string }) {
  const userId = getUserId(request);
  if (!userId) {
    return Response.json({ error: "Missing user ID" }, { status: 401 });
  }

  const { passcode } = await request.json();
  if (!passcode) {
    return Response.json({ error: "Passcode is required" }, { status: 400 });
  }

  // Validate passcode (endpoint-specific auth)
  const { data: waitlist } = await supabase
    .from("waitlists")
    .select("id, passcode")
    .eq("id", id)
    .single();

  if (!waitlist) {
    return Response.json({ error: "Waitlist not found" }, { status: 404 });
  }

  if (waitlist.passcode !== passcode) {
    return Response.json({ error: "Invalid passcode" }, { status: 403 });
  }

  const activeRow = await hasActiveRow(id, userId);
  if (activeRow) {
    return Response.json(
      { error: `Already in waitlist with status: ${activeRow.status}` },
      { status: 409 },
    );
  }

  try {
    const player = await joinAndAdvance(id, userId);
    posthogServer?.capture({
      distinctId: userId,
      event: "queue_joined",
      properties: { waitlist_id: id },
    });
    return Response.json(player, { status: 201 });
  } catch (e) {
    if (e instanceof ServiceError) {
      return Response.json({ error: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[api]", msg, e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
