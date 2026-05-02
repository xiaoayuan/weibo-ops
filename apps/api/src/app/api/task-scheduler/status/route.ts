import { requireApiRole } from "@/src/lib/permissions";
import { getRateLimitSnapshot } from "@/src/lib/rate-limit";
import { getTaskSchedulerSnapshot } from "@/src/lib/task-scheduler";

export async function GET() {
  const auth = await requireApiRole("VIEWER");
  if (!auth.ok) {
    return auth.response;
  }

  const [workers, rateLimit] = await Promise.all([
    getTaskSchedulerSnapshot(),
    getRateLimitSnapshot(auth.session.role === "ADMIN" ? undefined : auth.session.id),
  ]);

  return Response.json({
    success: true,
    data: {
      workerCount: workers.length,
      workers,
      rateLimit,
      updatedAt: new Date().toISOString(),
    },
  });
}
