import { WorkerPool } from "@/server/task-scheduler/worker-pool";
import type { ScheduledTask } from "@/server/task-scheduler/types";

declare global {
  var __taskSchedulerPool: WorkerPool | undefined;
}

function getWorkerPool() {
  if (!globalThis.__taskSchedulerPool) {
    globalThis.__taskSchedulerPool = new WorkerPool(2);
  }

  return globalThis.__taskSchedulerPool;
}

export async function scheduleTask<T>(task: ScheduledTask<T>) {
  return getWorkerPool().submit(task);
}

export async function getTaskSchedulerSnapshot() {
  return getWorkerPool().getSnapshot();
}
