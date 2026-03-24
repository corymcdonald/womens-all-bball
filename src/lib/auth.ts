import { supabase } from "./supabase";

// Extract user ID from request headers
export function getUserId(request: Request): string | null {
  return request.headers.get("x-user-id");
}

// Verify the requesting user is an admin
export async function requireAdmin(request: Request) {
  const userId = getUserId(request);
  if (!userId) {
    throw new Response(JSON.stringify({ error: "Missing user ID" }), {
      status: 401,
    });
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Response(JSON.stringify({ error: "User not found" }), {
      status: 401,
    });
  }

  if (data.role !== "admin") {
    throw new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403,
    });
  }

  return data;
}
