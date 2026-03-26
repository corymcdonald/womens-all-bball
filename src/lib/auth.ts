import { verifyToken } from "@clerk/backend";
import { supabase } from "./supabase";

// Extract user ID from request headers (guest-safe, not cryptographically verified)
export function getUserId(request: Request): string | null {
  return request.headers.get("x-user-id");
}

/**
 * Verify the Clerk JWT from the Authorization header, look up the user by
 * clerk_id, and confirm they have the admin role.
 *
 * Throws a Response on failure (Expo Router convention).
 */
export async function requireAdmin(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = authHeader.slice(7);

  let clerkId: string;
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    clerkId = payload.sub;
  } catch {
    throw new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, role")
    .eq("clerk_id", clerkId)
    .single();

  if (error || !data) {
    throw new Response(JSON.stringify({ error: "User not found" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (data.role !== "admin") {
    throw new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return data;
}

/**
 * Non-throwing admin check — verifies Clerk JWT and checks admin role.
 * Returns true only if the token is valid and the user is an admin.
 */
export async function isAdmin(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("clerk_id", payload.sub)
      .single();

    return data?.role === "admin";
  } catch {
    return false;
  }
}
