import { requireAdmin } from "@/lib/auth";
import { checkAndAdvance } from "@/lib/services/orchestrator";
import { ServiceError } from "@/lib/services/service-error";
import { supabase } from "@/lib/supabase";

/**
 * Manually trigger the next game for a completed game's waitlist.
 * Delegates to the orchestrator which handles locking, team formation,
 * player status transitions, and game creation.
 */
export async function POST(request: Request, { id }: { id: string }) {
  await requireAdmin(request);

  const { data: game } = await supabase
    .from("games")
    .select("waitlist_id, status")
    .eq("id", id)
    .eq("status", "completed")
    .single();

  if (!game) {
    return Response.json(
      { error: "Completed game not found" },
      { status: 404 },
    );
  }

  try {
    await checkAndAdvance(game.waitlist_id);
    return Response.json({ success: true });
  } catch (e) {
    if (e instanceof ServiceError) {
      return Response.json({ error: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[api]", msg, e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
