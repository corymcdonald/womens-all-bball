import { publishEvent } from "@/lib/ably";
import { requireAdmin } from "@/lib/auth";
import { posthogServer } from "@/lib/posthog-server";
import { formTeamFromQueue, getUsedColors } from "@/lib/services/team-service";

export async function POST(request: Request, { id }: { id: string }) {
  const admin = await requireAdmin(request);

  try {
    const usedColors = await getUsedColors(id);
    const result = await formTeamFromQueue(id, [...usedColors]);

    if (!result) {
      return Response.json(
        { error: "Not enough players to form a team" },
        { status: 400 },
      );
    }

    posthogServer?.capture({
      distinctId: admin.id,
      event: "team_formed",
      properties: { waitlist_id: id },
    });
    await publishEvent(`waitlist:${id}`, "updated");
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
