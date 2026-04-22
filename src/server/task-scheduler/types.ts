export type ScheduledTaskKind = "PLAN" | "INTERACTION" | "ACTION_JOB";

export class ScheduledTaskCancelledError extends Error {
  constructor(message = "任务已停止") {
    super(message);
    this.name = "ScheduledTaskCancelledError";
  }
}

export type ScheduledTaskResult<T> = {
  workerId: string;
  userConcurrency: number;
  queueDepth: number;
  data: T;
};

export type ScheduledTask<T> = {
  kind: ScheduledTaskKind;
  id: string;
  ownerUserId: string;
  label: string;
  run: () => Promise<T>;
};
