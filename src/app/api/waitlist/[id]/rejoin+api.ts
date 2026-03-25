import { getUserId } from "@/lib/auth";
import { hasActiveRow } from "@/lib/waitlist";
import { joinAndAdvance } from "@/lib/services/orchestrator";
import { ServiceError } from "@/lib/services/service-error";
import { posthogServer } from "@/lib/posthog-server";

export async function POST(request: Request, { id }: { id: string }) {
  const userId = getUserId(request);
  if (!userId) {
    return Response.json({ error: "Missing user ID" }, { status: 401 });
  }

  const activeRow = await hasActiveRow(id, userId);
  if (activeRow) {
    return Response.json(
      { error: `Cannot rejoin while status is: ${activeRow.status}` },
      { status: 409 },
    );
  }

  try {
    const player = await joinAndAdvance(id, userId);
    posthogServer?.capture({
      distinctId: userId,
      event: "queue_rejoined",
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
