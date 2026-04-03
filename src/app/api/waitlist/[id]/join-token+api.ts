import { getUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { hasActiveRow } from "@/lib/waitlist";
import { joinAndAdvance } from "@/lib/services/orchestrator";
import { handleRouteError } from "@/lib/api-error";
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

  const { data: waitlist } = await supabase
    .from("waitlists")
    .select("token_grace_period_minutes")
    .eq("id", id)
    .single();

  const gracePeriodMinutes = waitlist?.token_grace_period_minutes ?? 5;
  const graceMs = gracePeriodMinutes * 60 * 1000;
  const tokenExpiredAt = new Date(tokenRow.expires_at).getTime();
  if (tokenExpiredAt + graceMs < Date.now()) {
    const minutesPastExpiry = Math.round(
      (Date.now() - tokenExpiredAt) / 60_000,
    );
    posthogServer?.capture({
      distinctId: userId,
      event: "token_expired_attempt",
      properties: {
        waitlist_id: id,
        token,
        minutes_past_expiry: minutesPastExpiry,
        grace_period_minutes: gracePeriodMinutes,
        token_expired_at: tokenRow.expires_at,
      },
    });
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
    return handleRouteError(e);
  }
}
