import { supabase } from "@/lib/supabase";

export async function GET(request: Request, { id }: { id: string }) {
  const { data, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, phone, role")
    .eq("id", id)
    .single();

  if (error || !data) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json(data);
}
