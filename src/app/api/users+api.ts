import { handleRouteError } from "@/lib/api-error";
import { requireAdmin, verifyClerkToken } from "@/lib/auth";
import { posthogServer } from "@/lib/posthog-server";
import { joinAndAdvance } from "@/lib/services/orchestrator";
import {
  listUsersByRole,
  lookupUserByClerkId,
  registerOrUpsertUser,
  searchUsersByName,
} from "@/lib/services/user-service";
import { supabase } from "@/lib/supabase";

// GET /api/users?q=search&role=admin&clerk_id=xxx
export async function GET(request: Request) {
  const url = new URL(request.url);
  const clerkId = url.searchParams.get("clerk_id");
  const query = url.searchParams.get("q");
  const role = url.searchParams.get("role");

  try {
    if (clerkId) {
      const data = await lookupUserByClerkId(request, clerkId);
      return Response.json(data);
    }

    if (query) {
      await requireAdmin(request);
      const data = await searchUsersByName(query);
      return Response.json(data);
    }

    if (role) {
      await requireAdmin(request);
      const data = await listUsersByRole(role);
      return Response.json(data);
    }

    return Response.json(
      {
        error:
          "Query parameter required: ?q=name, ?role=admin, or ?clerk_id=xxx",
      },
      { status: 400 },
    );
  } catch (e) {
    return handleRouteError(e);
  }
}

// POST /api/users — register (optionally join a waitlist in the same request)
export async function POST(request: Request) {
  const {
    first_name,
    last_name,
    email,
    push_token,
    clerk_id,
    waitlist_id,
    token,
  } = await request.json();

  if (!first_name || !last_name) {
    return Response.json(
      { error: "first_name and last_name are required" },
      { status: 400 },
    );
  }

  // If joining a waitlist, validate the token up front before creating the user
  if (waitlist_id && token) {
    const { data: tokenRow } = await supabase
      .from("waitlist_tokens")
      .select("id, waitlist_id, expires_at")
      .eq("token", token)
      .eq("waitlist_id", waitlist_id)
      .single();

    if (!tokenRow) {
      return Response.json({ error: "Invalid token" }, { status: 403 });
    }

    const { data: waitlist } = await supabase
      .from("waitlists")
      .select("token_grace_period_minutes")
      .eq("id", waitlist_id)
      .single();

    const gracePeriodMinutes =
      waitlist?.token_grace_period_minutes ?? 5;
    const graceMs = gracePeriodMinutes * 60 * 1000;
    const tokenExpiredAt = new Date(tokenRow.expires_at).getTime();
    if (tokenExpiredAt + graceMs < Date.now()) {
      const minutesPastExpiry = Math.round(
        (Date.now() - tokenExpiredAt) / 60_000,
      );
      posthogServer?.capture({
        distinctId: "anonymous_registration",
        event: "token_expired_attempt",
        properties: {
          waitlist_id,
          token,
          minutes_past_expiry: minutesPastExpiry,
          grace_period_minutes: gracePeriodMinutes,
          token_expired_at: tokenRow.expires_at,
          first_name,
          last_name,
        },
      });
      return Response.json({ error: "Token expired" }, { status: 403 });
    }
  }

  try {
    let verifiedClerkId: string | undefined;
    if (clerk_id) {
      verifiedClerkId = await verifyClerkToken(request, clerk_id);
    }

    const data = await registerOrUpsertUser({
      first_name,
      last_name,
      email,
      push_token,
      verifiedClerkId,
    });

    // Auto-join the waitlist queue if the token was validated
    let joined = false;
    if (waitlist_id && token) {
      try {
        await joinAndAdvance(waitlist_id, data.id);
        joined = true;
        posthogServer?.capture({
          distinctId: data.id,
          event: "queue_joined",
          properties: { waitlist_id, method: "registration" },
        });
      } catch {
        // Join failed (e.g. already in queue) — don't block registration
      }
    }

    return Response.json({ ...data, joined }, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
