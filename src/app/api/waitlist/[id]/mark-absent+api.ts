import { publishEvent } from "@/lib/ably";
import { requireAdmin } from "@/lib/auth";
import { removeFromPlay } from "@/lib/services/queue-service";
import { checkAndAdvance } from "@/lib/services/orchestrator";
import { ServiceError } from "@/lib/services/service-error";
import { posthogServer } from "@/lib/posthog-server";

export async function POST(request: Request, { id }: { id: string }) {
  const admin = await requireAdmin(request);

  const { waitlist_player_id, team_id } = await request.json();

  if (!waitlist_player_id) {
    return Response.json(
      { error: "waitlist_player_id is required" },
      { status: 400 },
    );
  }

  try {
    const result = await removeFromPlay(
      id,
      waitlist_player_id,
      "absent",
      team_id,
    );
    posthogServer?.capture({
      distinctId: admin.id,
      event: "player_marked_absent",
      properties: {
        waitlist_id: id,
        waitlist_player_id,
        team_id: team_id ?? null,
        had_replacement: !!result.replacement,
      },
    });
    await publishEvent(`waitlist:${id}`, "updated");
    await checkAndAdvance(id);
    return Response.json(result);
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
