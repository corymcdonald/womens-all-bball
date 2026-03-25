import { supabase } from "@/lib/supabase";
import { hasActiveRow } from "@/lib/waitlist";
import { getUserId } from "@/lib/auth";
import { publishEvent } from "@/lib/ably";

export async function POST(request: Request, { id }: { id: string }) {
  const userId = getUserId(request);
  if (!userId) {
    return Response.json({ error: "Missing user ID" }, { status: 401 });
  }

  const { token } = await request.json();
  if (!token) {
    return Response.json({ error: "Token is required" }, { status: 400 });
  }

  // Validate token exists, matches this waitlist, and hasn't expired
  const { data: tokenRow } = await supabase
    .from("waitlist_tokens")
    .select("id, waitlist_id, expires_at")
    .eq("token", token)
    .eq("waitlist_id", id)
    .single();

  if (!tokenRow) {
    return Response.json({ error: "Invalid token" }, { status: 403 });
  }

  // 30s grace period so scans near expiry still work
  const GRACE_PERIOD_MS = 30 * 1000;
  if (new Date(tokenRow.expires_at).getTime() + GRACE_PERIOD_MS < Date.now()) {
    return Response.json({ error: "Token expired" }, { status: 403 });
  }

  // If already in the waitlist, just return success (token validated = authorized)
  const activeRow = await hasActiveRow(id, userId);
  if (activeRow) {
    return Response.json({ authorized: true, existing: activeRow });
  }

  // Join the waitlist
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
    // Handle race condition: unique constraint means they joined between our check and insert
    if (error.code === "23505") {
      return Response.json({ authorized: true, existing: true });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  await publishEvent(`waitlist:${id}`, "updated");

  return Response.json(data, { status: 201 });
}
