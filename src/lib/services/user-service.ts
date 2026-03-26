import { createClerkClient } from "@clerk/backend";
import { supabase } from "@/lib/supabase";
import { verifyClerkToken } from "@/lib/auth";
import { ServiceError } from "./service-error";
import type { User } from "@/lib/types";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

const USER_SELECT = "id, first_name, last_name, email, clerk_id, role";

/**
 * Look up a user by clerk_id after verifying JWT ownership.
 */
export async function lookupUserByClerkId(
  request: Request,
  clerkId: string,
): Promise<User> {
  await verifyClerkToken(request, clerkId);

  const { data, error } = await supabase
    .from("users")
    .select(USER_SELECT)
    .eq("clerk_id", clerkId)
    .single();

  if (error || !data) {
    throw new ServiceError("User not found", 404);
  }

  return data as User;
}

/**
 * Search users by name (ilike on first/last name).
 */
export async function searchUsersByName(query: string): Promise<User[]> {
  const search = `%${query.trim()}%`;
  const { data, error } = await supabase
    .from("users")
    .select(USER_SELECT)
    .or(`first_name.ilike.${search},last_name.ilike.${search}`)
    .order("first_name")
    .limit(20);

  if (error) {
    throw new ServiceError(error.message, 500);
  }

  return (data ?? []) as User[];
}

/**
 * List users by role.
 */
export async function listUsersByRole(role: string): Promise<User[]> {
  const { data, error } = await supabase
    .from("users")
    .select(USER_SELECT)
    .eq("role", role)
    .order("first_name");

  if (error) {
    throw new ServiceError(error.message, 500);
  }

  return (data ?? []) as User[];
}

/**
 * Register or upsert a user. Handles clerk, email, and guest flows.
 */
export async function registerOrUpsertUser(body: {
  first_name: string;
  last_name: string;
  email?: string;
  push_token?: string;
  verifiedClerkId?: string;
}): Promise<User> {
  const { first_name, last_name, email, push_token, verifiedClerkId } = body;

  const fields: Record<string, unknown> = {
    first_name,
    last_name,
    ...(email ? { email } : {}),
    ...(verifiedClerkId ? { clerk_id: verifiedClerkId } : {}),
    ...(push_token ? { push_token } : {}),
  };

  const query = verifiedClerkId
    ? supabase.from("users").upsert(fields, { onConflict: "clerk_id" })
    : email
      ? await buildEmailUpsertQuery(fields, email)
      : supabase.from("users").insert(fields);

  const { data, error } = await query.select().single();

  if (error) {
    throw new ServiceError(error.message, 500);
  }

  return data as User;
}

async function buildEmailUpsertQuery(
  fields: Record<string, unknown>,
  email: string,
) {
  const { data: existing } = await supabase
    .from("users")
    .select("clerk_id")
    .eq("email", email)
    .single();

  if (existing?.clerk_id) {
    throw new ServiceError(
      "This email is linked to a full account. Please sign in instead.",
      409,
    );
  }

  return supabase.from("users").upsert(fields, { onConflict: "email" });
}

/**
 * Link a Clerk account to an existing user.
 * Verifies JWT, checks for duplicates, syncs email from Clerk.
 */
export async function linkClerkAccount(
  request: Request,
  userId: string,
  clerkId: string,
): Promise<Record<string, unknown>> {
  const verifiedClerkId = await verifyClerkToken(request, clerkId);

  const { data: existing } = await supabase
    .from("users")
    .select("clerk_id, email")
    .eq("id", userId)
    .single();

  if (existing?.clerk_id) {
    throw new ServiceError("Account is already linked", 409);
  }

  const updates: Record<string, unknown> = { clerk_id: verifiedClerkId };

  // Sync email from Clerk if local email is missing
  if (!existing?.email) {
    try {
      const clerkUser = await clerk.users.getUser(verifiedClerkId);
      const clerkEmail =
        clerkUser.emailAddresses.find(
          (e) => e.id === clerkUser.primaryEmailAddressId,
        )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
      if (clerkEmail) {
        updates.email = clerkEmail;
      }
    } catch {
      // Non-critical — email can be added later
    }
  }

  return updates;
}

/**
 * Resolve target user ID from either an existing user_id or new user fields.
 */
export async function resolveTargetUserId(
  userId?: string,
  firstName?: string,
  lastName?: string,
): Promise<string> {
  if (userId) return userId;

  if (!firstName || !lastName) {
    throw new ServiceError(
      "Either user_id or first_name and last_name are required",
      400,
    );
  }

  const { data, error } = await supabase
    .from("users")
    .insert({ first_name: firstName, last_name: lastName })
    .select()
    .single();

  if (error || !data) {
    throw new ServiceError("Failed to create user", 500);
  }

  return data.id;
}

/**
 * Anonymize a user account: mark waitlist entries as left, clear PII, delete Clerk user.
 */
export async function anonymizeUser(
  userId: string,
  clerkId: string | null,
): Promise<void> {
  await supabase
    .from("waitlist_players")
    .update({ status: "left" })
    .eq("user_id", userId)
    .in("status", ["waiting", "playing", "absent"]);

  const { error } = await supabase
    .from("users")
    .update({
      first_name: "Anonymous",
      last_name: "Anonymous",
      email: null,
      push_token: null,
      clerk_id: null,
      role: "player",
    })
    .eq("id", userId);

  if (error) {
    throw new ServiceError(error.message, 500);
  }

  if (clerkId) {
    try {
      await clerk.users.deleteUser(clerkId);
    } catch {
      // Clerk user may already be deleted
    }
  }
}
