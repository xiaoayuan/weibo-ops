export type ScheduledTaskKind = "PLAN" | "INTERACTION" | "ACTION_JOB";

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
