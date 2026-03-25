import { getUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request, { id }: { id: string }) {
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

  // Anonymize the user instead of deleting to preserve game history
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
