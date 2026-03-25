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

  const { token } = await request.json();
  if (!token) {
    return Response.json({ error: "Token is required" }, { status: 400 });
  }

  // Validate token (endpoint-specific auth)
  const { data: tokenRow } = await supabase
    .from("waitlist_tokens")
    .select("id, waitlist_id, expires_at")
    .eq("token", token)
    .eq("waitlist_id", id)
    .single();

  if (!tokenRow) {
    return Response.json({ error: "Invalid token" }, { status: 403 });
  }

  const GRACE_PERIOD_MS = 30 * 1000;
  if (new Date(tokenRow.expires_at).getTime() + GRACE_PERIOD_MS < Date.now()) {
    return Response.json({ error: "Token expired" }, { status: 403 });
  }

  // Already in waitlist = success (token validated = authorized)
  const activeRow = await hasActiveRow(id, userId);
  if (activeRow) {
    return Response.json({ authorized: true, existing: activeRow });
  }

  try {
    const player = await joinAndAdvance(id, userId);
    posthogServer?.capture({
      distinctId: userId,
      event: "queue_joined_with_token",
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
