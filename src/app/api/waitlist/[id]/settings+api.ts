import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { publishEvent } from "@/lib/ably";

export async function POST(request: Request, { id }: { id: string }) {
  await requireAdmin(request);

  const body = await request.json();
  const updates: Record<string, number> = {};

  if (body.max_wins !== undefined) {
    if (body.max_wins !== 2 && body.max_wins !== 3) {
      return Response.json(
        { error: "max_wins must be 2 or 3" },
        { status: 400 },
      );
    }
    updates.max_wins = body.max_wins;
  }

  if (body.game_duration_minutes !== undefined) {
    if (body.game_duration_minutes !== 5 && body.game_duration_minutes !== 6) {
      return Response.json(
        { error: "game_duration_minutes must be 5 or 6" },
        { status: 400 },
      );
    }
    updates.game_duration_minutes = body.game_duration_minutes;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json(
      { error: "No valid settings provided" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("waitlists")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await publishEvent(`waitlist:${id}`, "settings:updated", {
    max_wins: data.max_wins,
    game_duration_minutes: data.game_duration_minutes,
  });

  return Response.json(data);
}
