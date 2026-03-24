import { supabase } from "@/lib/supabase";
import { hasActiveRow } from "@/lib/waitlist";
import { getUserId } from "@/lib/auth";
import { publishEvent } from "@/lib/ably";

export async function POST(request: Request, { id }: { id: string }) {
  const userId = getUserId(request);
  if (!userId) {
    return Response.json({ error: "Missing user ID" }, { status: 401 });
  }

  // Check for existing active row - can't rejoin while active
  const activeRow = await hasActiveRow(id, userId);
  if (activeRow) {
    return Response.json(
      { error: `Cannot rejoin while status is: ${activeRow.status}` },
      { status: 409 },
    );
  }

  // Create a new row (new created_at places them at end of queue)
  const { data, error } = await supabase
    .from("waitlist_players")
    .insert({
      waitlist_id: id,
      user_id: userId,
      status: "waiting",
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await publishEvent(`waitlist:${id}`, "updated");

  return Response.json(data, { status: 201 });
}
