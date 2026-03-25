import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

const TOKEN_TTL_SECONDS = 60;

export async function POST(request: Request, { id }: { id: string }) {
  await requireAdmin(request);

  // Get the waitlist passcode
  const { data: waitlist } = await supabase
    .from("waitlists")
    .select("passcode")
    .eq("id", id)
    .single();

  if (!waitlist) {
    return Response.json({ error: "Waitlist not found" }, { status: 404 });
  }

  // Generate a short suffix from a UUID (4 hex chars)
  const suffix = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
  const token = `${waitlist.passcode}-${suffix}`;

  const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000);

  const { data, error } = await supabase
    .from("waitlist_tokens")
    .insert({
      waitlist_id: id,
      token,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    token: data.token,
    expires_at: data.expires_at,
    ttl_seconds: TOKEN_TTL_SECONDS,
  });
}
