import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { hasActiveRow } from "@/lib/waitlist";
import { publishEvent } from "@/lib/ably";

export async function POST(request: Request, { id }: { id: string }) {
  await requireAdmin(request);

  const { user_id, first_name, last_name } = await request.json();

  let targetUserId = user_id;

  // If no user_id provided, create a new user with just a name
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

  // Check for existing active row
  const activeRow = await hasActiveRow(id, targetUserId);
  if (activeRow) {
    return Response.json(
      { error: `Player already in waitlist with status: ${activeRow.status}` },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("waitlist_players")
    .insert({
      waitlist_id: id,
      user_id: targetUserId,
      status: "waiting",
    })
    .select("*, users(id, first_name, last_name)")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await publishEvent(`waitlist:${id}`, "updated");

  return Response.json(data, { status: 201 });
}
