import { requireAdmin, verifyClerkToken } from "@/lib/auth";
import { handleRouteError } from "@/lib/api-error";
import {
  lookupUserByClerkId,
  searchUsersByName,
  listUsersByRole,
  registerOrUpsertUser,
} from "@/lib/services/user-service";

// GET /api/users?q=search&role=admin&clerk_id=xxx
export async function GET(request: Request) {
  const url = new URL(request.url);
  const clerkId = url.searchParams.get("clerk_id");
  const query = url.searchParams.get("q");
  const role = url.searchParams.get("role");

  try {
    if (clerkId) {
      const data = await lookupUserByClerkId(request, clerkId);
      return Response.json(data);
    }

    if (query) {
      await requireAdmin(request);
      const data = await searchUsersByName(query);
      return Response.json(data);
    }

    if (role) {
      await requireAdmin(request);
      const data = await listUsersByRole(role);
      return Response.json(data);
    }

    return Response.json(
      { error: "Query parameter required: ?q=name, ?role=admin, or ?clerk_id=xxx" },
      { status: 400 },
    );
  } catch (e) {
    return handleRouteError(e);
  }
}

// POST /api/users — register
export async function POST(request: Request) {
  const { first_name, last_name, email, push_token, clerk_id } =
    await request.json();

  if (!first_name || !last_name) {
    return Response.json(
      { error: "first_name and last_name are required" },
      { status: 400 },
    );
  }

  try {
    let verifiedClerkId: string | undefined;
    if (clerk_id) {
      verifiedClerkId = await verifyClerkToken(request, clerk_id);
    }

    const data = await registerOrUpsertUser({
      first_name,
      last_name,
      email,
      push_token,
      verifiedClerkId,
    });

    return Response.json(data, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
