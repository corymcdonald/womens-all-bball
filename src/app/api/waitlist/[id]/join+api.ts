import { getUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { hasActiveRow } from "@/lib/waitlist";
import { joinAndAdvance } from "@/lib/services/orchestrator";
import { handleRouteError } from "@/lib/api-error";
import { posthogServer } from "@/lib/posthog-server";

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

async function validatePasscode(
  request: Request,
  waitlistId: string,
): Promise<void> {
  const body = await request.json();
  const passcode = body?.passcode;
  if (!passcode) {
    throw new Response(
      JSON.stringify({ error: "Passcode is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data: waitlist } = await supabase
    .from("waitlists")
    .select("id, passcode")
    .eq("id", waitlistId)
    .single();

  if (!waitlist) {
    throw new Response(
      JSON.stringify({ error: "Waitlist not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  if (waitlist.passcode.toLowerCase() !== passcode.toLowerCase()) {
    throw new Response(
      JSON.stringify({ error: "Invalid passcode" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }
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

  const previouslyJoined = await hasPreviousRow(id, userId);
  if (!previouslyJoined) {
    await validatePasscode(request, id);
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
