import { requireAdmin } from "@/lib/auth";
import { posthogServer } from "@/lib/posthog-server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request, { id }: { id: string }) {
  const { data, error } = await supabase
    .from("teams")
    .select("*, team_players(user_id, users(id, first_name, last_name))")
    .eq("id", id)
    .single();

  if (error || !data) {
    return Response.json({ error: "Team not found" }, { status: 404 });
  }

  return Response.json(data);
}

export async function PATCH(request: Request, { id }: { id: string }) {
  const admin = await requireAdmin(request);

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.color !== undefined) updates.color = body.color;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("teams")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return Response.json({ error: "Team not found" }, { status: 404 });
  }

  posthogServer?.capture({
    distinctId: admin.id,
    event: "team_color_updated",
    properties: { team_id: id, color: body.color },
  });

  return Response.json(data);
}
