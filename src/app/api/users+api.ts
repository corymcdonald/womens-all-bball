import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { first_name, last_name, phone, push_token } = await request.json();

  if (!first_name || !last_name) {
    return Response.json(
      { error: "first_name and last_name are required" },
      { status: 400 },
    );
  }

  // If phone is provided, upsert by phone. Otherwise create a new user.
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
