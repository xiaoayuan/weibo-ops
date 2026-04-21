import { SchedulerMonitor } from "@/components/scheduler/scheduler-monitor";
import { requirePageRole } from "@/lib/permissions";
import { getTaskSchedulerSnapshot } from "@/server/task-scheduler";

export const dynamic = "force-dynamic";

export default async function SchedulerPage() {
  const session = await requirePageRole("VIEWER");
  const snapshot = await getTaskSchedulerSnapshot();
  const workers =
    session.role === "ADMIN"
      ? snapshot
      : snapshot.map((worker) => ({
          ...worker,
          users: worker.users.filter((user) => user.userId === session.id),
        }));

  return <SchedulerMonitor initialData={{ workerCount: snapshot.length, workers, updatedAt: new Date().toISOString() }} />;
}
