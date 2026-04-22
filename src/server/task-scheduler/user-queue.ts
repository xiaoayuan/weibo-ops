type QueueTask<T> = {
  kind: string;
  id: string;
  label: string;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export type UserQueueSnapshot = {
  pendingCount: number;
  runningCount: number;
  pendingLabels: string[];
  runningLabels: string[];
};

export class UserQueue {
  private pending: Array<QueueTask<unknown>> = [];
  private readonly runningLabels = new Set<string>();
  private running = 0;
  private concurrency: number;

  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  enqueue<T>(task: QueueTask<T>) {
    this.pending.push(task as QueueTask<unknown>);
    this.drain();
  }

  getPendingCount() {
    return this.pending.length;
  }

  getRunningCount() {
    return this.running;
  }

  setConcurrency(nextConcurrency: number) {
    this.concurrency = Math.max(1, nextConcurrency);
    this.drain();
  }

  cancelPending(kind: string, id: string, error: unknown) {
    const nextPending: Array<QueueTask<unknown>> = [];
    let removed = 0;

    for (const task of this.pending) {
      if (task.kind === kind && task.id === id) {
        removed += 1;
        task.reject(error);
        continue;
      }

      nextPending.push(task);
    }

    this.pending = nextPending;
    return removed;
  }

  getSnapshot(): UserQueueSnapshot {
    return {
      pendingCount: this.pending.length,
      runningCount: this.running,
      pendingLabels: this.pending.map((task) => task.label),
      runningLabels: Array.from(this.runningLabels),
    };
  }

  private drain() {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift();

      if (!task) {
        return;
      }

      this.running += 1;
      this.runningLabels.add(task.label);
      task
        .run()
        .then(task.resolve)
        .catch(task.reject)
        .finally(() => {
          this.runningLabels.delete(task.label);
          this.running -= 1;
          this.drain();
        });
    }
  }
}
