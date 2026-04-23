import { prisma } from "@/lib/prisma";
import type { ScheduledTaskLane } from "@/server/task-scheduler/types";

type PlanType = "CHECK_IN" | "FIRST_COMMENT" | "POST" | "LIKE" | "COMMENT";
type ActionJobType = "COMMENT_LIKE_BATCH" | "REPOST_ROTATION";
type InteractionActionType = "CHECK_IN" | "FIRST_COMMENT" | "POST" | "LIKE" | "COMMENT";

export type TaskTier = "S" | "A" | "B";

export type ManagedTaskType = "DAILY_PLAN" | "QUICK_REPLY" | "COMMENT_CONTROL" | "REPOST_ROTATION";

type RateLimitState = {
  nextAvailableAt?: string;
};

type RateLimitRule = {
  globalPerMinute: number;
  taskTypePerMinute: number;
  userPerMinute: number;
};

export type RateLimitDecision = {
  taskType: ManagedTaskType;
  baseTier: TaskTier;
  effectiveTier: TaskTier;
  lane: ScheduledTaskLane;
  delayMs: number;
  reasons: string[];
};

const settingKeyPrefix = "rate_limit_v1";

const taskRateRules: Record<ManagedTaskType, RateLimitRule> = {
  DAILY_PLAN: {
    globalPerMinute: 6,
    taskTypePerMinute: 4,
    userPerMinute: 2,
  },
  QUICK_REPLY: {
    globalPerMinute: 18,
    taskTypePerMinute: 12,
    userPerMinute: 6,
  },
  COMMENT_CONTROL: {
    globalPerMinute: 30,
    taskTypePerMinute: 24,
    userPerMinute: 12,
  },
  REPOST_ROTATION: {
    globalPerMinute: 12,
    taskTypePerMinute: 8,
    userPerMinute: 4,
  },
};

function stateKey(scope: "global" | "taskType" | "user", value: string) {
  return `${settingKeyPrefix}:${scope}:${value}`;
}

function intervalMs(perMinute: number) {
  return Math.max(1_000, Math.ceil(60_000 / Math.max(1, perMinute)));
}

function toDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function getRateLimitState(key: string) {
  const setting = await prisma.systemSetting.findUnique({ where: { key }, select: { value: true } });

  if (!setting?.value || typeof setting.value !== "object" || Array.isArray(setting.value)) {
    return {} satisfies RateLimitState;
  }

  return setting.value as RateLimitState;
}

async function saveRateLimitState(key: string, value: RateLimitState) {
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: value as never },
    update: { value: value as never },
  });
}

function getEffectiveTier(taskType: ManagedTaskType, baseTier: TaskTier, delayMs: number): TaskTier {
  if (taskType === "DAILY_PLAN") {
    return "B";
  }

  if (baseTier === "S" && taskType !== "COMMENT_CONTROL" && delayMs >= 2 * 60_000) {
    return "A";
  }

  if (baseTier === "A" && delayMs >= 20 * 60_000) {
    return "B";
  }

  return baseTier;
}

export function taskTierToLane(tier: TaskTier): ScheduledTaskLane {
  return tier === "B" ? "SLOW" : "URGENT";
}

export function resolvePlanTaskType(planType: PlanType): ManagedTaskType {
  void planType;
  return "DAILY_PLAN";
}

export function resolveInteractionTaskType(actionType: InteractionActionType): ManagedTaskType {
  void actionType;
  return "QUICK_REPLY";
}

export function resolveActionJobTaskType(jobType: ActionJobType): ManagedTaskType {
  return jobType === "COMMENT_LIKE_BATCH" ? "COMMENT_CONTROL" : "REPOST_ROTATION";
}

export async function reserveRateLimitedExecution(input: {
  ownerUserId: string;
  taskType: ManagedTaskType;
  baseTier: TaskTier;
}) {
  const now = Date.now();
  const rules = taskRateRules[input.taskType];
  const keys = {
    global: stateKey("global", "all"),
    taskType: stateKey("taskType", input.taskType),
    user: stateKey("user", input.ownerUserId),
  };

  const [globalState, taskTypeState, userState] = await Promise.all([
    getRateLimitState(keys.global),
    getRateLimitState(keys.taskType),
    getRateLimitState(keys.user),
  ]);

  const reservations = [
    {
      reason: "GLOBAL_RATE_LIMIT",
      nextAt: toDate(globalState.nextAvailableAt)?.getTime() || now,
      stepMs: intervalMs(rules.globalPerMinute),
      key: keys.global,
    },
    {
      reason: "TASK_TYPE_RATE_LIMIT",
      nextAt: toDate(taskTypeState.nextAvailableAt)?.getTime() || now,
      stepMs: intervalMs(rules.taskTypePerMinute),
      key: keys.taskType,
    },
    {
      reason: "USER_RATE_LIMIT",
      nextAt: toDate(userState.nextAvailableAt)?.getTime() || now,
      stepMs: intervalMs(rules.userPerMinute),
      key: keys.user,
    },
  ];

  const slotAt = Math.max(now, ...reservations.map((item) => item.nextAt));
  const delayMs = Math.max(0, slotAt - now);
  const reasons = reservations.filter((item) => item.nextAt > now).map((item) => item.reason);
  const effectiveTier = getEffectiveTier(input.taskType, input.baseTier, delayMs);

  await Promise.all(
    reservations.map((item) =>
      saveRateLimitState(item.key, {
        nextAvailableAt: new Date(slotAt + item.stepMs).toISOString(),
      }),
    ),
  );

  return {
    taskType: input.taskType,
    baseTier: input.baseTier,
    effectiveTier,
    lane: taskTierToLane(effectiveTier),
    delayMs,
    reasons,
  } satisfies RateLimitDecision;
}
