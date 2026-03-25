import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  await requireAdmin(request);

  const { data, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, phone, role")
    .eq("role", "admin")
    .order("first_name");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
