import { getUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request, { id }: { id: string }) {
  const requesterId = getUserId(request);
  if (!requesterId || requesterId !== id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, string> = {};

  if (body.first_name !== undefined) updates.first_name = body.first_name;
  if (body.last_name !== undefined) updates.last_name = body.last_name;
  if (body.phone !== undefined) updates.phone = body.phone || null;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select("id, first_name, last_name, phone, role")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
