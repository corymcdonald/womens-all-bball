import { verifyToken } from "@clerk/backend";
import { supabase } from "./supabase";

function jsonResponse(body: { error: string }, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Extract user ID from request headers (guest-safe, not cryptographically verified)
export function getUserId(request: Request): string | null {
  return request.headers.get("x-user-id");
}

/**
 * Verify the Clerk JWT from the Authorization header.
 * Returns the clerk_id (sub claim) on success.
 * If expectedClerkId is provided, validates the token's sub matches it.
 * Throws a Response on failure (Expo Router convention).
 */
export async function verifyClerkToken(
  request: Request,
  expectedClerkId?: string,
): Promise<string> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw jsonResponse({ error: "Authentication required" }, 401);
  }

  let clerkId: string;
  try {
    const payload = await verifyToken(authHeader.slice(7), {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    clerkId = payload.sub;
  } catch {
    throw jsonResponse({ error: "Invalid or expired token" }, 401);
  }

  if (expectedClerkId && clerkId !== expectedClerkId) {
    throw jsonResponse({ error: "Token does not match clerk_id" }, 403);
  }

  return clerkId;
}

/**
 * Verify the Clerk JWT, look up the user by clerk_id, and confirm admin role.
 * Throws a Response on failure.
 */
export async function requireAdmin(request: Request) {
  const clerkId = await verifyClerkToken(request);

  const { data, error } = await supabase
    .from("users")
    .select("id, role")
    .eq("clerk_id", clerkId)
    .single();

  if (error || !data) {
    throw jsonResponse({ error: "User not found" }, 401);
  }

  if (data.role !== "admin") {
    throw jsonResponse({ error: "Admin access required" }, 403);
  }

  return data;
}

/**
 * Non-throwing admin check — verifies Clerk JWT and checks admin role.
 */
export async function isAdmin(request: Request): Promise<boolean> {
  try {
    const clerkId = await verifyClerkToken(request);
    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("clerk_id", clerkId)
      .single();

    return data?.role === "admin";
  } catch {
    return false;
  }
}
