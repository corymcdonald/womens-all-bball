import { getUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { hasActiveRow } from "@/lib/waitlist";
import { joinAndAdvance } from "@/lib/services/orchestrator";
import { handleRouteError } from "@/lib/api-error";
import { posthogServer } from "@/lib/posthog-server";

/**
 * Check if the user has any previous (inactive) row in this waitlist,
 * meaning they were previously invited and don't need the passcode again.
 */
async function hasPreviousRow(
  waitlistId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("waitlist_players")
    .select("id")
    .eq("waitlist_id", waitlistId)
    .eq("user_id", userId)
    .in("status", ["completed", "left"])
    .limit(1);

  if (error) throw error;
  return data.length > 0;
}

export async function POST(request: Request, { id }: { id: string }) {
  const userId = getUserId(request);
  if (!userId) {
    return Response.json({ error: "Missing user ID" }, { status: 401 });
  }

  const activeRow = await hasActiveRow(id, userId);
  if (activeRow) {
    return Response.json(
      { error: `Already in waitlist with status: ${activeRow.status}` },
      { status: 409 },
    );
  }

  // Skip passcode validation for returning players (previously invited)
  const previouslyJoined = await hasPreviousRow(id, userId);

  if (!previouslyJoined) {
    const body = await request.json();
    const passcode = body?.passcode;
    if (!passcode) {
      return Response.json({ error: "Passcode is required" }, { status: 400 });
    }

    const { data: waitlist } = await supabase
      .from("waitlists")
      .select("id, passcode")
      .eq("id", id)
      .single();

    if (!waitlist) {
      return Response.json({ error: "Waitlist not found" }, { status: 404 });
    }

    if (waitlist.passcode.toLowerCase() !== passcode.toLowerCase()) {
      return Response.json({ error: "Invalid passcode" }, { status: 403 });
    }
  }

  try {
    const player = await joinAndAdvance(id, userId);
    posthogServer?.capture({
      distinctId: userId,
      event: previouslyJoined ? "queue_rejoined" : "queue_joined",
      properties: { waitlist_id: id },
    });
    return Response.json(player, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
