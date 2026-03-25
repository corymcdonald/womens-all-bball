import { publishEvent } from "@/lib/ably";
import { getUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { hasActiveRow } from "@/lib/waitlist";

export async function POST(request: Request, { id }: { id: string }) {
  const userId = getUserId(request);
  if (!userId) {
    return Response.json({ error: "Missing user ID" }, { status: 401 });
  }

  const { passcode } = await request.json();
  if (!passcode) {
    return Response.json({ error: "Passcode is required" }, { status: 400 });
  }

  // Verify waitlist and passcode
  const { data: waitlist } = await supabase
    .from("waitlists")
    .select("id, passcode")
    .eq("id", id)
    .single();

  if (!waitlist) {
    return Response.json({ error: "Waitlist not found" }, { status: 404 });
  }

  if (waitlist.passcode !== passcode) {
    return Response.json({ error: "Invalid passcode" }, { status: 403 });
  }

  // Check for existing active row
  const activeRow = await hasActiveRow(id, userId);
  if (activeRow) {
    return Response.json(
      { error: `Already in waitlist with status: ${activeRow.status}` },
      { status: 409 },
    );
  }

  // Create new waitlist_players row
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
    if (error.code === "23505") {
      return Response.json({ authorized: true, existing: true });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  await publishEvent(`waitlist:${id}`, "updated");

  return Response.json(data, { status: 201 });
}
