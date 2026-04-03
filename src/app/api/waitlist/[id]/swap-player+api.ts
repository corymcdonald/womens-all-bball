import { handleRouteError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth";
import { posthogServer } from "@/lib/posthog-server";
import { swapPlayerAndNotify } from "@/lib/services/orchestrator";

export async function POST(request: Request, { id }: { id: string }) {
  const admin = await requireAdmin(request);

  const { team_id, user_id, replacement_user_id } = await request.json();

  if (!team_id || !user_id) {
    return Response.json(
      { error: "team_id and user_id are required" },
      { status: 400 },
    );
  }

  try {
    const result = await swapPlayerAndNotify(
      id,
      team_id,
      user_id,
      replacement_user_id,
    );

    posthogServer?.capture({
      distinctId: admin.id,
      event: "player_swapped",
      properties: {
        waitlist_id: id,
        team_id,
        removed_user_id: user_id,
        replacement_user_id: replacement_user_id ?? null,
      },
    });

    return Response.json(result);
  } catch (e) {
    return handleRouteError(e);
  }
}
