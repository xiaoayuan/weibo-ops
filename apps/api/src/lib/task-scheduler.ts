import { WorkerPool } from "@/src/lib/task-worker-pool";
import type { ScheduledTask } from "@/src/lib/task-scheduler-types";

declare global {
  var __apiTaskSchedulerPool: WorkerPool | undefined;
}

function getWorkerPool() {
  if (!globalThis.__apiTaskSchedulerPool) {
    const workerCount = Math.max(4, Math.min(16, Number(process.env.TASK_SCHEDULER_WORKERS) || 8));
    globalThis.__apiTaskSchedulerPool = new WorkerPool(workerCount);
    console.log(`[API-WorkerPool] 初始化完成，使用 ${workerCount} 个 worker`);
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
