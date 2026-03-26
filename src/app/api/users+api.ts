import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { verifyToken } from "@clerk/backend";

// GET /api/users?q=search&role=admin&clerk_id=xxx
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const role = url.searchParams.get("role");
  const clerkId = url.searchParams.get("clerk_id");

  // Look up by Clerk ID — caller must prove they own this clerk_id via JWT
  if (clerkId) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    try {
      const payload = await verifyToken(authHeader.slice(7), {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      if (payload.sub !== clerkId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    } catch {
      return Response.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

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

  // Verify JWT when clerk_id is provided
  let verifiedClerkId: string | undefined;
  if (clerk_id) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Authentication required for clerk_id" },
        { status: 401 },
      );
    }
    try {
      const payload = await verifyToken(authHeader.slice(7), {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      if (payload.sub !== clerk_id) {
        return Response.json(
          { error: "Token does not match clerk_id" },
          { status: 403 },
        );
      }
      verifiedClerkId = payload.sub;
    } catch {
      return Response.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }
  }

  const upsertFields: Record<string, unknown> = {
    first_name,
    last_name,
    ...(email ? { email } : {}),
    ...(verifiedClerkId ? { clerk_id: verifiedClerkId } : {}),
    ...(push_token ? { push_token } : {}),
  };

  let query;
  if (verifiedClerkId) {
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
