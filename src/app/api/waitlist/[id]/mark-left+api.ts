import { publishEvent } from "@/lib/ably";
import { requireAdmin } from "@/lib/auth";
import { removeFromPlay } from "@/lib/services/queue-service";
import { checkAndAdvance } from "@/lib/services/orchestrator";
import { ServiceError } from "@/lib/services/service-error";

export async function POST(request: Request, { id }: { id: string }) {
  await requireAdmin(request);

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
      "left",
      team_id,
    );
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
