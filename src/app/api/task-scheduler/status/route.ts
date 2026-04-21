import { requireApiRole } from "@/lib/permissions";
import { getTaskSchedulerSnapshot } from "@/server/task-scheduler";

export async function GET() {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const snapshot = await getTaskSchedulerSnapshot();
  const visibleSnapshot =
    auth.session.role === "ADMIN"
      ? snapshot
      : snapshot.map((worker) => ({
          ...worker,
          users: worker.users.filter((user) => user.userId === auth.session.id),
        }));

  return Response.json({
    success: true,
    data: {
      workerCount: snapshot.length,
      workers: visibleSnapshot,
      updatedAt: new Date().toISOString(),
    },
  });
}
