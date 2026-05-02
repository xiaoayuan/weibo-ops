import { listVisibleExecutionLogs } from "@/src/lib/logs";
import { requireApiRole } from "@/src/lib/permissions";

export async function GET(request: Request) {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim() || undefined;
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "50");

  const result = await listVisibleExecutionLogs(auth.session, userId, { page, pageSize });
  return Response.json({ success: true, ...result });
}
