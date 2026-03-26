import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { publishEvent } from "@/lib/ably";
import { posthogServer } from "@/lib/posthog-server";

export async function POST(request: Request, { id }: { id: string }) {
  const admin = await requireAdmin(request);

  const { player_ids } = await request.json();

  if (!Array.isArray(player_ids) || player_ids.length === 0) {
    return Response.json(
      { error: "player_ids must be a non-empty array" },
      { status: 400 },
    );
  }

  // Assign sequential priorities to all players in the given order
  const updates = player_ids.map((playerId: string, index: number) =>
    supabase
      .from("waitlist_players")
      .update({ priority: index + 1 })
      .eq("id", playerId)
      .eq("waitlist_id", id)
      .eq("status", "waiting"),
  );

  const results = await Promise.all(updates);
  const errors = results.filter((r) => r.error);

  if (errors.length > 0) {
    return Response.json(
      { error: "Some updates failed", details: errors.map((e) => e.error) },
      { status: 500 },
    );
  }

  await publishEvent(`waitlist:${id}`, "updated");

  posthogServer?.capture({
    distinctId: admin.id,
    event: "queue_reordered",
    properties: { waitlist_id: id, players_count: player_ids.length },
  });

  return Response.json({ success: true, reordered: player_ids.length });
}
