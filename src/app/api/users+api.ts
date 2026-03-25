import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// GET /api/users?q=search&role=admin
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const role = url.searchParams.get("role");

  // Search by name (admin only)
  if (query) {
    await requireAdmin(request);

    const search = `%${query.trim()}%`;
    const { data, error } = await supabase
      .from("users")
      .select("id, first_name, last_name, phone, role")
      .or(`first_name.ilike.${search},last_name.ilike.${search}`)
      .order("first_name")
      .limit(20);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json(data);
  }

  // Filter by role (admin only)
  if (role) {
    await requireAdmin(request);

    const { data, error } = await supabase
      .from("users")
      .select("id, first_name, last_name, phone, role")
      .eq("role", role)
      .order("first_name");

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json(data);
  }

  return Response.json(
    { error: "Query parameter required: ?q=name or ?role=admin" },
    { status: 400 },
  );
}

// POST /api/users — register/upsert
export async function POST(request: Request) {
  const { first_name, last_name, phone, push_token } = await request.json();

  if (!first_name || !last_name) {
    return Response.json(
      { error: "first_name and last_name are required" },
      { status: 400 },
    );
  }

  const query = phone
    ? supabase
        .from("users")
        .upsert(
          {
            phone,
            first_name,
            last_name,
            ...(push_token ? { push_token } : {}),
          },
          { onConflict: "phone" },
        )
        .select()
        .single()
    : supabase
        .from("users")
        .insert({
          first_name,
          last_name,
          ...(push_token ? { push_token } : {}),
        })
        .select()
        .single();

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
