import { requireAdmin } from "@/lib/auth";
import { handleRouteError } from "@/lib/api-error";
import { joinAndAdvance } from "@/lib/services/orchestrator";
import { resolveTargetUserId } from "@/lib/services/user-service";
import { hasActiveRow } from "@/lib/waitlist";
import { posthogServer } from "@/lib/posthog-server";

export async function POST(request: Request, { id }: { id: string }) {
  const admin = await requireAdmin(request);
  const { user_id, first_name, last_name } = await request.json();

  try {
    const targetUserId = await resolveTargetUserId(user_id, first_name, last_name);

    const activeRow = await hasActiveRow(id, targetUserId);
    if (activeRow) {
      return Response.json(
        { error: `Player already in waitlist with status: ${activeRow.status}` },
        { status: 409 },
      );
    }

    const player = await joinAndAdvance(id, targetUserId);
    posthogServer?.capture({
      distinctId: admin.id,
      event: "player_added_by_admin",
      properties: { waitlist_id: id, target_user_id: targetUserId, created_new_user: !user_id },
    });
    return Response.json(player, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
