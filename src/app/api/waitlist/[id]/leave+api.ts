import { publishEvent } from "@/lib/ably";
import { getUserId } from "@/lib/auth";
import { leaveQueue } from "@/lib/services/queue-service";
import { handleRouteError } from "@/lib/api-error";
import { posthogServer } from "@/lib/posthog-server";

export async function POST(request: Request, { id }: { id: string }) {
  const userId = getUserId(request);
  if (!userId) {
    return Response.json({ error: "Missing user ID" }, { status: 401 });
  }

  try {
    const data = await leaveQueue(id, userId);
    posthogServer?.capture({
      distinctId: userId,
      event: "queue_left",
      properties: { waitlist_id: id },
    });
    await publishEvent(`waitlist:${id}`, "updated");
    return Response.json(data);
  } catch (e) {
    return handleRouteError(e);
  }
}
