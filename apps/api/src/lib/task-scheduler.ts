import { WorkerPool } from "@/src/lib/task-worker-pool";
import type { ScheduledTask } from "@/src/lib/task-scheduler-types";

declare global {
  var __apiTaskSchedulerPool: WorkerPool | undefined;
}

function getWorkerPool() {
  if (!globalThis.__apiTaskSchedulerPool) {
    globalThis.__apiTaskSchedulerPool = new WorkerPool(2);
  }

  return globalThis.__apiTaskSchedulerPool;
}

export async function scheduleTask<T>(task: ScheduledTask<T>) {
  return getWorkerPool().submit(task);
}

export async function cancelTask(task: Pick<ScheduledTask<unknown>, "kind" | "id" | "ownerUserId">) {
  return getWorkerPool().cancel(task);
}

export async function getTaskSchedulerSnapshot() {
  return getWorkerPool().getSnapshot();
}
