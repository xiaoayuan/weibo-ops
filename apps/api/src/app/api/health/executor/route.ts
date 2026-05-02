import { getExecutorHealthStatus } from "@/src/lib/executor-index";
import { requireApiRole } from "@/src/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiRole("VIEWER");
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const status = getExecutorHealthStatus();
    return Response.json({ success: true, data: status });
  } catch {
    return Response.json({ success: false, message: "读取执行器状态失败" }, { status: 500 });
  }
}
