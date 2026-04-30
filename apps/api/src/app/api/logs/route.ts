import { listVisibleExecutionLogs } from "@/src/lib/logs";
import { requireApiRole } from "@/src/lib/permissions";

export async function GET(request: Request) {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim() || undefined;

  const logs = await listVisibleExecutionLogs(auth.session, userId);
  return Response.json({ success: true, data: logs });
}
