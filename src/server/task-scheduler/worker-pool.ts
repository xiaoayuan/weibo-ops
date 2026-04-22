import { prisma } from "@/lib/prisma";
import { UserQueue } from "@/server/task-scheduler/user-queue";
import { ScheduledTaskCancelledError, type ScheduledTask, type ScheduledTaskResult } from "@/server/task-scheduler/types";

type WorkerState = {
  id: string;
  queues: Map<string, UserQueue>;
};

function hashUserId(userId: string) {
  let hash = 0;

  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  }

  return hash;
}

async function loadUserConcurrency(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { taskConcurrency: true },
  });

  return Math.max(1, user?.taskConcurrency || 1);
}

export class WorkerPool {
  private readonly workers: WorkerState[];

  constructor(workerCount: number) {
    this.workers = Array.from({ length: workerCount }, (_, index) => ({
      id: `worker-${index}`,
      queues: new Map<string, UserQueue>(),
    }));
  }

  async submit<T>(task: ScheduledTask<T>): Promise<ScheduledTaskResult<T>> {
    const worker = this.workers[hashUserId(task.ownerUserId) % this.workers.length];
    let queue = worker.queues.get(task.ownerUserId);
    let concurrency = 1;

    if (!queue) {
      concurrency = await loadUserConcurrency(task.ownerUserId);
      queue = new UserQueue(concurrency);
      worker.queues.set(task.ownerUserId, queue);
    } else {
      concurrency = await loadUserConcurrency(task.ownerUserId);
      queue.setConcurrency(concurrency);
    }

    const queueDepth = queue.getPendingCount() + queue.getRunningCount() + 1;

    return new Promise<ScheduledTaskResult<T>>((resolve, reject) => {
      queue.enqueue({
        kind: task.kind,
        id: task.id,
        label: task.label,
        run: async () => ({
          workerId: worker.id,
          userConcurrency: concurrency,
          queueDepth,
          data: await task.run(),
        }),
        resolve,
        reject,
      });
    });
  }

  async cancel(task: Pick<ScheduledTask<unknown>, "kind" | "id" | "ownerUserId">) {
    const worker = this.workers[hashUserId(task.ownerUserId) % this.workers.length];
    const queue = worker.queues.get(task.ownerUserId);

    if (!queue) {
      return { removed: 0 };
    }

    const removed = queue.cancelPending(task.kind, task.id, new ScheduledTaskCancelledError());
    return { removed };
  }

  async getSnapshot() {
    const userIds = Array.from(new Set(this.workers.flatMap((worker) => Array.from(worker.queues.keys()))));
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, taskConcurrency: true },
        })
      : [];
    const userMap = new Map(users.map((user) => [user.id, user]));

    return this.workers.map((worker) => ({
      workerId: worker.id,
      queueCount: worker.queues.size,
      users: Array.from(worker.queues.entries()).map(([userId, queue]) => ({
        userId,
        username: userMap.get(userId)?.username || null,
        taskConcurrency: userMap.get(userId)?.taskConcurrency || 1,
        ...queue.getSnapshot(),
      })),
    }));
  }
}
