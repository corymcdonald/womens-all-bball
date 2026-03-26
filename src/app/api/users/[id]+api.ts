import { createClerkClient, verifyToken } from "@clerk/backend";
import { getUserId, requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { posthogServer } from "@/lib/posthog-server";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

// GET /api/users/:id
export async function GET(request: Request, { id }: { id: string }) {
  const { data, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, email, clerk_id, role")
    .eq("id", id)
    .single();

  if (error || !data) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json(data);
}

// PATCH /api/users/:id — update profile (self) or promote (admin)
export async function PATCH(request: Request, { id }: { id: string }) {
  const requesterId = getUserId(request);
  if (!requesterId) {
    return Response.json({ error: "Missing user ID" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  // Profile fields — only the user themselves can update
  if (
    body.first_name !== undefined ||
    body.last_name !== undefined ||
    body.email !== undefined
  ) {
    if (requesterId !== id) {
      return Response.json(
        { error: "Can only update your own profile" },
        { status: 403 },
      );
    }
    if (body.first_name !== undefined) updates.first_name = body.first_name;
    if (body.last_name !== undefined) updates.last_name = body.last_name;
    if (body.email !== undefined) updates.email = body.email || null;
  }

  // Link Clerk account — verify JWT proves ownership of the clerk_id
  if (body.clerk_id !== undefined) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Authentication required to link account" },
        { status: 401 },
      );
    }

    let verifiedClerkId: string;
    try {
      const payload = await verifyToken(authHeader.slice(7), {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      verifiedClerkId = payload.sub;
    } catch {
      return Response.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    if (verifiedClerkId !== body.clerk_id) {
      return Response.json(
        { error: "Token does not match clerk_id" },
        { status: 403 },
      );
    }

    // Check if already linked
    const { data: existing } = await supabase
      .from("users")
      .select("clerk_id, email")
      .eq("id", id)
      .single();

    if (existing?.clerk_id) {
      return Response.json(
        { error: "Account is already linked" },
        { status: 409 },
      );
    }

    updates.clerk_id = verifiedClerkId;

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
        // Non-critical — email can be added later in Settings
      }
    }
  }

  // Role — only admins can change
  let admin: { id: string; role: string } | null = null;
  if (body.role !== undefined) {
    admin = await requireAdmin(request);
    updates.role = body.role;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select("id, first_name, last_name, email, clerk_id, role")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (admin && body.role !== undefined) {
    posthogServer?.capture({
      distinctId: admin.id,
      event: "user_role_changed",
      properties: { target_user_id: id, new_role: body.role },
    });
  }

  return Response.json(data);
}

// DELETE /api/users/:id — anonymize account
export async function DELETE(request: Request, { id }: { id: string }) {
  // Look up the user to determine auth method
  const { data: user } = await supabase
    .from("users")
    .select("clerk_id")
    .eq("id", id)
    .single();

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if (user.clerk_id) {
    // Linked account: require verified Clerk JWT
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    try {
      const payload = await verifyToken(authHeader.slice(7), {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      if (payload.sub !== user.clerk_id) {
        return Response.json({ error: "Unauthorized" }, { status: 403 });
      }
    } catch {
      return Response.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }
  } else {
    // Guest account: x-user-id is the only option
    const requesterId = getUserId(request);
    if (!requesterId || requesterId !== id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Mark all active waitlist entries as left
  await supabase
    .from("waitlist_players")
    .update({ status: "left" })
    .eq("user_id", id)
    .in("status", ["waiting", "playing", "absent"]);

  // Anonymize the user to preserve game history
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
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Delete the Clerk user account
  if (user?.clerk_id) {
    try {
      await clerk.users.deleteUser(user.clerk_id);
    } catch {
      // Clerk user may already be deleted — don't block the response
    }
  }

  posthogServer?.capture({
    distinctId: id,
    event: "account_deleted",
    properties: { had_clerk_account: !!user?.clerk_id },
  });

  return Response.json({ success: true });
}
