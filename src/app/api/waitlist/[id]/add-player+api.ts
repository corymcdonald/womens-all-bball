import { requireAdmin } from "@/lib/auth";
import { joinAndAdvance } from "@/lib/services/orchestrator";
import { ServiceError } from "@/lib/services/service-error";
import { supabase } from "@/lib/supabase";
import { hasActiveRow } from "@/lib/waitlist";

export async function POST(request: Request, { id }: { id: string }) {
  await requireAdmin(request);

  const { user_id, first_name, last_name } = await request.json();

  let targetUserId = user_id;

  if (!targetUserId) {
    if (!first_name || !last_name) {
      return Response.json(
        { error: "Either user_id or first_name and last_name are required" },
        { status: 400 },
      );
    }

    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert({ first_name, last_name })
      .select()
      .single();

    if (userError || !newUser) {
      return Response.json({ error: "Failed to create user" }, { status: 500 });
    }

    targetUserId = newUser.id;
  }

  const activeRow = await hasActiveRow(id, targetUserId);
  if (activeRow) {
    return Response.json(
      { error: `Player already in waitlist with status: ${activeRow.status}` },
      { status: 409 },
    );
  }

  try {
    const player = await joinAndAdvance(id, targetUserId);
    return Response.json(player, { status: 201 });
  } catch (e) {
    if (e instanceof ServiceError) {
      return Response.json({ error: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[api]", msg, e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
