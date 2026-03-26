import { getUserId, requireAdmin, verifyClerkToken } from "@/lib/auth";
import { handleRouteError } from "@/lib/api-error";
import { supabase } from "@/lib/supabase";
import { posthogServer } from "@/lib/posthog-server";
import { linkClerkAccount, anonymizeUser } from "@/lib/services/user-service";

const USER_SELECT = "id, first_name, last_name, email, clerk_id, role";

const PROFILE_FIELDS = ["first_name", "last_name", "email"] as const;

function applyProfileUpdates(
  body: Record<string, unknown>,
  updates: Record<string, unknown>,
) {
  for (const field of PROFILE_FIELDS) {
    if (body[field] !== undefined) {
      updates[field] = field === "email" ? body[field] || null : body[field];
    }
  }
}

function hasProfileFields(body: Record<string, unknown>): boolean {
  return PROFILE_FIELDS.some((f) => body[f] !== undefined);
}

// GET /api/users/:id
export async function GET(request: Request, { id }: { id: string }) {
  const { data, error } = await supabase
    .from("users")
    .select(USER_SELECT)
    .eq("id", id)
    .single();

  if (error || !data) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json(data);
}

async function applyUpdates(
  id: string,
  updates: Record<string, unknown>,
  admin: { id: string } | null,
  newRole?: string,
): Promise<Response> {
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select(USER_SELECT)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (admin && newRole !== undefined) {
    posthogServer?.capture({
      distinctId: admin.id,
      event: "user_role_changed",
      properties: { target_user_id: id, new_role: newRole },
    });
  }

  return Response.json(data);
}

// PATCH /api/users/:id — update profile (self), link Clerk (self), or change role (admin)
export async function PATCH(request: Request, { id }: { id: string }) {
  const requesterId = getUserId(request);
  if (!requesterId) {
    return Response.json({ error: "Missing user ID" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  try {
    // Profile fields — only the user themselves can update
    if (hasProfileFields(body)) {
      if (requesterId !== id) {
        return Response.json({ error: "Can only update your own profile" }, { status: 403 });
      }
      applyProfileUpdates(body, updates);
    }

    // Clerk account linking — delegates JWT verification + email sync to service
    if (body.clerk_id !== undefined) {
      const linkUpdates = await linkClerkAccount(request, id, body.clerk_id);
      Object.assign(updates, linkUpdates);
    }

    // Role — only admins can change
    let admin: { id: string; role: string } | null = null;
    if (body.role !== undefined) {
      admin = await requireAdmin(request);
      updates.role = body.role;
    }

    return applyUpdates(id, updates, admin, body.role);
  } catch (e) {
    return handleRouteError(e);
  }
}

// DELETE /api/users/:id — anonymize account
export async function DELETE(request: Request, { id }: { id: string }) {
  const { data: user } = await supabase
    .from("users")
    .select("clerk_id")
    .eq("id", id)
    .single();

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  try {
    // Verify ownership: Clerk JWT for linked accounts, x-user-id for guests
    if (user.clerk_id) {
      await verifyClerkToken(request, user.clerk_id);
    } else {
      const requesterId = getUserId(request);
      if (!requesterId || requesterId !== id) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    await anonymizeUser(id, user.clerk_id);

    posthogServer?.capture({
      distinctId: id,
      event: "account_deleted",
      properties: { had_clerk_account: !!user.clerk_id },
    });

    return Response.json({ success: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
