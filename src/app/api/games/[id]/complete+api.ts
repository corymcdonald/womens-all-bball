import { requireAdmin } from "@/lib/auth";
import { posthogServer } from "@/lib/posthog-server";
import { declareWinnerAndAdvance } from "@/lib/services/orchestrator";
import { ServiceError } from "@/lib/services/service-error";

export async function POST(request: Request, { id }: { id: string }) {
  const admin = await requireAdmin(request);

  const { winner_id } = await request.json();

  if (!winner_id) {
    return Response.json({ error: "winner_id is required" }, { status: 400 });
  }

  try {
    const result = await declareWinnerAndAdvance(id, winner_id);

    posthogServer?.capture({
      distinctId: admin.id,
      event: "game_completed",
      properties: {
        game_id: id,
        waitlist_id: result.waitlistId,
        winner_team_id: result.winnerId,
        loser_team_id: result.loserId,
        streak: result.streak,
        streak_maxed: result.streakMaxed,
      },
    });

    return Response.json({
      game_id: result.gameId,
      winner_id: result.winnerId,
      losing_team_id: result.loserId,
      streak: result.streak,
      streak_maxed: result.streakMaxed,
      players_needed: result.playersNeeded,
    });
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
