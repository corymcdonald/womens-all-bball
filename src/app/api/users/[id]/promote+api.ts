import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: Request, { id }: { id: string }) {
  await requireAdmin(request);

  const { data, error } = await supabase
    .from("users")
    .update({ role: "admin" })
    .eq("id", id)
    .select("id, first_name, last_name, phone, role")
    .single();

  if (error || !data) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json(data);
}
