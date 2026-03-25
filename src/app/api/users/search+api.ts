import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  await requireAdmin(request);

  const url = new URL(request.url);
  const query = url.searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return Response.json(
      { error: "Search query must be at least 2 characters" },
      { status: 400 },
    );
  }

  const search = `%${query.trim()}%`;

  const { data, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, phone, role")
    .or(`first_name.ilike.${search},last_name.ilike.${search}`)
    .order("first_name")
    .limit(20);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
