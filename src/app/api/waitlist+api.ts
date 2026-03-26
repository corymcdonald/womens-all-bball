import { PASSCODES } from "@/constants/passcodes";
import { isAdmin, requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// GET /api/waitlist — list all waitlists (passcode included only for admins)
export async function GET(request: Request) {
  const { data, error } = await supabase
    .from("waitlists")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const admin = await isAdmin(request);
  if (!admin) {
    const safe = (data ?? []).map(({ passcode, ...rest }) => rest);
    return Response.json(safe);
  }

  return Response.json(data);
}

// POST /api/waitlist — create a new waitlist (admin only)
export async function POST(request: Request) {
  await requireAdmin(request);

  const body = await request.json().catch(() => ({}));
  const passcode =
    body.passcode ?? PASSCODES[Math.floor(Math.random() * PASSCODES.length)];

  const { data, error } = await supabase
    .from("waitlists")
    .insert({ passcode })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
