import { WorkerPool } from "@/server/task-scheduler/worker-pool";
import type { ScheduledTask } from "@/server/task-scheduler/types";

declare global {
  var __taskSchedulerPool: WorkerPool | undefined;
}

function getWorkerPool() {
  if (!globalThis.__taskSchedulerPool) {
    const workerCount = Math.max(4, Math.min(16, Number(process.env.TASK_SCHEDULER_WORKERS) || 8));
    globalThis.__taskSchedulerPool = new WorkerPool(workerCount);
    console.log(`[WorkerPool] 初始化完成，使用 ${workerCount} 个 worker`);
  }

  return globalThis.__taskSchedulerPool;
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
