import { ServiceError } from "@/lib/services/service-error";

export function handleRouteError(e: unknown): Response {
  if (e instanceof ServiceError) {
    return Response.json({ error: e.message }, { status: e.statusCode });
  }
  const msg = e instanceof Error ? e.message : "Internal error";
  console.error("[api]", msg, e);
  return Response.json({ error: msg }, { status: 500 });
}
