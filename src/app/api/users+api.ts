import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// GET /api/users?q=search&role=admin&clerk_id=xxx
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const role = url.searchParams.get("role");
  const clerkId = url.searchParams.get("clerk_id");

  // Look up by Clerk ID (used after sign-in to find linked Supabase user)
  if (clerkId) {
    const { data, error } = await supabase
      .from("users")
      .select("id, first_name, last_name, email, clerk_id, role")
      .eq("clerk_id", clerkId)
      .single();

    if (error || !data) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    return Response.json(data);
  }

  // Search by name (admin only)
  if (query) {
    await requireAdmin(request);

    const search = `%${query.trim()}%`;
    const { data, error } = await supabase
      .from("users")
      .select("id, first_name, last_name, email, clerk_id, role")
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
      .select("id, first_name, last_name, email, clerk_id, role")
      .eq("role", role)
      .order("first_name");

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json(data);
  }

  return Response.json(
    {
      error: "Query parameter required: ?q=name, ?role=admin, or ?clerk_id=xxx",
    },
    { status: 400 },
  );
}

// POST /api/users — register
export async function POST(request: Request) {
  const { first_name, last_name, email, push_token, clerk_id } =
    await request.json();

  if (!first_name || !last_name) {
    return Response.json(
      { error: "first_name and last_name are required" },
      { status: 400 },
    );
  }

  // If clerk_id provided, upsert by it (for admin linking)
  // If email provided, upsert by email (for guest re-registration)
  // Otherwise insert a new row
  const upsertFields: Record<string, unknown> = {
    first_name,
    last_name,
    ...(email ? { email } : {}),
    ...(clerk_id ? { clerk_id } : {}),
    ...(push_token ? { push_token } : {}),
  };

  let query;
  if (clerk_id) {
    query = supabase
      .from("users")
      .upsert(upsertFields, { onConflict: "clerk_id" })
      .select()
      .single();
  } else if (email) {
    // Block guest registration with an email that belongs to a linked account
    const { data: existing } = await supabase
      .from("users")
      .select("clerk_id")
      .eq("email", email)
      .single();

    if (existing?.clerk_id) {
      return Response.json(
        {
          error:
            "This email is linked to a full account. Please sign in instead.",
        },
        { status: 409 },
      );
    }

    query = supabase
      .from("users")
      .upsert(upsertFields, { onConflict: "email" })
      .select()
      .single();
  } else {
    query = supabase.from("users").insert(upsertFields).select().single();
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
