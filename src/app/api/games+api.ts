import { publishEvent } from "@/lib/ably";
import { requireAdmin } from "@/lib/auth";
import { createGame } from "@/lib/services/game-service";
import { ServiceError } from "@/lib/services/service-error";
import { posthogServer } from "@/lib/posthog-server";

export async function POST(request: Request) {
  const admin = await requireAdmin(request);

  const { waitlist_id, team1_id, team2_id } = await request.json();

  if (!waitlist_id || !team1_id || !team2_id) {
    return Response.json(
      { error: "waitlist_id, team1_id, and team2_id are required" },
      { status: 400 },
    );
  }

  try {
    const game = await createGame(waitlist_id, team1_id, team2_id);
    posthogServer?.capture({
      distinctId: admin.id,
      event: "game_started",
      properties: { waitlist_id, game_id: game.id },
    });
    await publishEvent(`waitlist:${waitlist_id}`, "game:started", {
      game_id: game.id,
    });
    return Response.json(game, { status: 201 });
  } catch (e) {
    if (e instanceof ServiceError) {
      return Response.json({ error: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[api]", msg, e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
