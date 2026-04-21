type QueueTask<T> = {
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
  private readonly pending: Array<QueueTask<unknown>> = [];
  private readonly runningLabels = new Set<string>();
  private running = 0;

  constructor(private readonly concurrency: number) {}

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
