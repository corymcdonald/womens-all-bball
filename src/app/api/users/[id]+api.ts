import { getUserId, requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// GET /api/users/:id
export async function GET(request: Request, { id }: { id: string }) {
  const { data, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, phone, role")
    .eq("id", id)
    .single();

  if (error || !data) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json(data);
}

// PATCH /api/users/:id — update profile (self) or promote (admin)
export async function PATCH(request: Request, { id }: { id: string }) {
  const requesterId = getUserId(request);
  if (!requesterId) {
    return Response.json({ error: "Missing user ID" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  // Profile fields — only the user themselves can update
  if (body.first_name !== undefined || body.last_name !== undefined || body.phone !== undefined) {
    if (requesterId !== id) {
      return Response.json({ error: "Can only update your own profile" }, { status: 403 });
    }
    if (body.first_name !== undefined) updates.first_name = body.first_name;
    if (body.last_name !== undefined) updates.last_name = body.last_name;
    if (body.phone !== undefined) updates.phone = body.phone || null;
  }

  // Role — only admins can change
  if (body.role !== undefined) {
    await requireAdmin(request);
    updates.role = body.role;
  }

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

// DELETE /api/users/:id — anonymize account
export async function DELETE(request: Request, { id }: { id: string }) {
  const requesterId = getUserId(request);
  if (!requesterId || requesterId !== id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Mark all active waitlist entries as left
  await supabase
    .from("waitlist_players")
    .update({ status: "left" })
    .eq("user_id", id)
    .in("status", ["waiting", "playing", "absent"]);

  // Anonymize the user to preserve game history
  const { error } = await supabase
    .from("users")
    .update({
      first_name: "Anonymous",
      last_name: "Anonymous",
      phone: null,
      push_token: null,
      role: "player",
    })
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
