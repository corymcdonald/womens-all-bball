import { supabase } from "@/lib/supabase";
import { hasActiveRow, transitionStatus } from "@/lib/waitlist";
import { getUserId } from "@/lib/auth";
import { publishEvent } from "@/lib/ably";

export async function POST(request: Request, { id }: { id: string }) {
  const userId = getUserId(request);
  if (!userId) {
    return Response.json({ error: "Missing user ID" }, { status: 401 });
  }

  const activeRow = await hasActiveRow(id, userId);
  if (!activeRow) {
    return Response.json(
      { error: "Not currently in the waitlist" },
      { status: 404 },
    );
  }

  // Only waiting and absent players can leave on their own
  if (activeRow.status !== "waiting" && activeRow.status !== "absent") {
    return Response.json(
      { error: `Cannot leave while status is: ${activeRow.status}` },
      { status: 400 },
    );
  }

  const data = await transitionStatus(activeRow.id, activeRow.status, "left");

  await publishEvent(`waitlist:${id}`, "updated");

  return Response.json(data);
}
