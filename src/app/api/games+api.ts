import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { publishEvent } from "@/lib/ably";

export async function POST(request: Request) {
  await requireAdmin(request);

  const { waitlist_id, team1_id, team2_id } = await request.json();

  if (!waitlist_id || !team1_id || !team2_id) {
    return Response.json(
      { error: "waitlist_id, team1_id, and team2_id are required" },
      { status: 400 },
    );
  }

  // Snapshot current waitlist settings onto the game
  const { data: waitlist } = await supabase
    .from("waitlists")
    .select("max_wins, game_duration_minutes")
    .eq("id", waitlist_id)
    .single();

  if (!waitlist) {
    return Response.json({ error: "Waitlist not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("games")
    .insert({
      waitlist_id,
      team1_id,
      team2_id,
      status: "in_progress",
      max_wins: waitlist.max_wins,
      game_duration_minutes: waitlist.game_duration_minutes,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await publishEvent(`waitlist:${waitlist_id}`, "game:started", {
    game_id: data.id,
  });

  return Response.json(data, { status: 201 });
}
