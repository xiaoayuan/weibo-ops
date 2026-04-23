type QueueTask<T> = {
  kind: string;
  id: string;
  label: string;
  lane: "SLOW" | "URGENT";
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export type UserQueueSnapshot = {
  pendingCount: number;
  runningCount: number;
  pendingUrgentCount: number;
  pendingSlowCount: number;
  runningUrgentCount: number;
  runningSlowCount: number;
  pendingLabels: string[];
  runningLabels: string[];
};

export class UserQueue {
  private pendingUrgent: Array<QueueTask<unknown>> = [];
  private pendingSlow: Array<QueueTask<unknown>> = [];
  private readonly runningLabels = new Set<string>();
  private running = 0;
  private runningUrgent = 0;
  private runningSlow = 0;
  private concurrency: number;

  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  enqueue<T>(task: QueueTask<T>) {
    if (task.lane === "URGENT") {
      this.pendingUrgent.push(task as QueueTask<unknown>);
    } else {
      this.pendingSlow.push(task as QueueTask<unknown>);
    }

    this.drain();
  }

  getPendingCount() {
    return this.pendingUrgent.length + this.pendingSlow.length;
  }

  getRunningCount() {
    return this.running;
  }

  setConcurrency(nextConcurrency: number) {
    this.concurrency = Math.max(1, nextConcurrency);
    this.drain();
  }

  cancelPending(kind: string, id: string, error: unknown) {
    const nextUrgent: Array<QueueTask<unknown>> = [];
    const nextSlow: Array<QueueTask<unknown>> = [];
    let removed = 0;

    for (const task of this.pendingUrgent) {
      if (task.kind === kind && task.id === id) {
        removed += 1;
        task.reject(error);
        continue;
      }

      nextUrgent.push(task);
    }

    for (const task of this.pendingSlow) {
      if (task.kind === kind && task.id === id) {
        removed += 1;
        task.reject(error);
        continue;
      }

      nextSlow.push(task);
    }

    this.pendingUrgent = nextUrgent;
    this.pendingSlow = nextSlow;
    return removed;
  }

  getSnapshot(): UserQueueSnapshot {
    return {
      pendingCount: this.getPendingCount(),
      runningCount: this.running,
      pendingUrgentCount: this.pendingUrgent.length,
      pendingSlowCount: this.pendingSlow.length,
      runningUrgentCount: this.runningUrgent,
      runningSlowCount: this.runningSlow,
      pendingLabels: [...this.pendingUrgent, ...this.pendingSlow].map((task) => task.label),
      runningLabels: Array.from(this.runningLabels),
    };
  }

  private getLaneConcurrency() {
    const total = Math.max(1, this.concurrency);
    const slow = total >= 2 ? 1 : 0;
    const urgent = Math.max(1, total - slow);

    return { total, urgent, slow };
  }

  private pickNextTask() {
    const { total, urgent, slow } = this.getLaneConcurrency();

    if (this.pendingUrgent.length > 0 && this.runningUrgent < urgent) {
      return this.pendingUrgent.shift();
    }

    if (this.pendingSlow.length > 0 && this.runningSlow < slow) {
      return this.pendingSlow.shift();
    }

    if (this.pendingUrgent.length > 0 && this.running < total) {
      return this.pendingUrgent.shift();
    }

    if (this.pendingSlow.length > 0 && this.running < total && this.pendingUrgent.length === 0) {
      return this.pendingSlow.shift();
    }

    return undefined;
  }

  private drain() {
    while (this.running < this.concurrency && this.getPendingCount() > 0) {
      const task = this.pickNextTask();

      if (!task) {
        return;
      }

      this.running += 1;
      if (task.lane === "URGENT") {
        this.runningUrgent += 1;
      } else {
        this.runningSlow += 1;
      }
      this.runningLabels.add(task.label);
      task
        .run()
        .then(task.resolve)
        .catch(task.reject)
        .finally(() => {
          this.runningLabels.delete(task.label);
          if (task.lane === "URGENT") {
            this.runningUrgent = Math.max(0, this.runningUrgent - 1);
          } else {
            this.runningSlow = Math.max(0, this.runningSlow - 1);
          }
          this.running -= 1;
          this.drain();
        });
    }
  }
}
