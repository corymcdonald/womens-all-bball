import { publishEvent } from "@/lib/ably";
import { handleRouteError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { createGame } from "@/lib/services/game-service";
import { posthogServer } from "@/lib/posthog-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);
  const cursor = url.searchParams.get("cursor");

  let query = supabase
    .from("games")
    .select(
      `*,
      waitlist:waitlists!games_waitlist_id_fkey(id, created_at),
      team1:teams!games_team1_id_fkey(id, color, team_players(user_id, users(id, first_name, last_name))),
      team2:teams!games_team2_id_fkey(id, color, team_players(user_id, users(id, first_name, last_name))),
      winner:teams!games_winner_id_fkey(id, color)`,
    )
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const hasMore = (data?.length ?? 0) > limit;
  const items = hasMore ? data!.slice(0, limit) : (data ?? []);
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;

  return Response.json({ data: items, cursor: nextCursor });
}

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
      properties: { waitlist_id, game_id: game.id, team1_id, team2_id },
    });
    await publishEvent(`waitlist:${waitlist_id}`, "game:started", {
      game_id: game.id,
    });
    return Response.json(game, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
