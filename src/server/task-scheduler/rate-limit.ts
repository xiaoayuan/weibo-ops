import { prisma } from "@/lib/prisma";
import type { ScheduledTaskLane } from "@/server/task-scheduler/types";

type PlanType = "CHECK_IN" | "FIRST_COMMENT" | "POST" | "LIKE" | "COMMENT" | "REPOST";
type ActionJobType = "COMMENT_LIKE_BATCH" | "REPOST_ROTATION";
type InteractionActionType = "CHECK_IN" | "FIRST_COMMENT" | "POST" | "LIKE" | "COMMENT" | "REPOST";

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

export type RateLimitSnapshotItem = {
  key: string;
  nextAvailableAt: string | null;
  waitMs: number;
  active: boolean;
};

export type RateLimitSnapshot = {
  global: RateLimitSnapshotItem | null;
  taskTypes: Array<RateLimitSnapshotItem & { taskType: ManagedTaskType }>;
  users: Array<RateLimitSnapshotItem & { userId: string; username: string | null }>;
  updatedAt: string;
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

function toSnapshotItem(key: string, state: RateLimitState): RateLimitSnapshotItem {
  const nextAvailableAt = toDate(state.nextAvailableAt);
  const waitMs = Math.max(0, (nextAvailableAt?.getTime() || 0) - Date.now());

  return {
    key,
    nextAvailableAt: nextAvailableAt?.toISOString() || null,
    waitMs,
    active: waitMs > 0,
  };
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

  // Lock and read current states atomically using FOR UPDATE to prevent race conditions
  const lockedRows = await prisma.$queryRaw<{ key: string; value: string | null }[]>`
    SELECT key, value::text
    FROM "SystemSetting"
    WHERE key IN (${keys.global}, ${keys.taskType}, ${keys.user})
    FOR UPDATE
  `;

  const stateMap = new Map<string, RateLimitState>();
  for (const row of lockedRows) {
    try {
      stateMap.set(row.key, row.value ? (JSON.parse(row.value) as RateLimitState) : {});
    } catch {
      stateMap.set(row.key, {});
    }
  }

  const reservations = [
    {
      reason: "GLOBAL_RATE_LIMIT",
      nextAt: toDate(stateMap.get(keys.global)?.nextAvailableAt)?.getTime() || now,
      stepMs: intervalMs(rules.globalPerMinute),
      key: keys.global,
    },
    {
      reason: "TASK_TYPE_RATE_LIMIT",
      nextAt: toDate(stateMap.get(keys.taskType)?.nextAvailableAt)?.getTime() || now,
      stepMs: intervalMs(rules.taskTypePerMinute),
      key: keys.taskType,
    },
    {
      reason: "USER_RATE_LIMIT",
      nextAt: toDate(stateMap.get(keys.user)?.nextAvailableAt)?.getTime() || now,
      stepMs: intervalMs(rules.userPerMinute),
      key: keys.user,
    },
  ];

  const slotAt = Math.max(now, ...reservations.map((item) => item.nextAt));
  const delayMs = Math.max(0, slotAt - now);
  const reasons = reservations.filter((item) => item.nextAt > now).map((item) => item.reason);
  const effectiveTier = getEffectiveTier(input.taskType, input.baseTier, delayMs);

  // Write new states in a transaction; FOR UPDATE locks ensure no concurrent modification
  await prisma.$transaction(
    reservations.map((item) =>
      prisma.systemSetting.upsert({
        where: { key: item.key },
        create: { key: item.key, value: { nextAvailableAt: new Date(slotAt + item.stepMs).toISOString() } as never },
        update: { value: { nextAvailableAt: new Date(slotAt + item.stepMs).toISOString() } as never },
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

export async function getRateLimitSnapshot(ownerUserId?: string): Promise<RateLimitSnapshot> {
  const taskTypes = Object.keys(taskRateRules) as ManagedTaskType[];
  const baseKeys = [stateKey("global", "all"), ...taskTypes.map((taskType) => stateKey("taskType", taskType))];

  const [baseSettings, userSettings, users] = await Promise.all([
    prisma.systemSetting.findMany({
      where: {
        key: {
          in: baseKeys,
        },
      },
      select: { key: true, value: true },
    }),
    prisma.systemSetting.findMany({
      where: ownerUserId
        ? {
            key: stateKey("user", ownerUserId),
          }
        : {
            key: {
              startsWith: `${settingKeyPrefix}:user:`,
            },
          },
      select: { key: true, value: true },
      orderBy: { updatedAt: "desc" },
    }),
    ownerUserId
      ? prisma.user.findMany({ where: { id: ownerUserId }, select: { id: true, username: true } })
      : prisma.user.findMany({ select: { id: true, username: true } }),
  ]);

  const settings = [...baseSettings, ...userSettings];

  const stateMap = new Map(
    settings.map((item) => [item.key, (item.value && typeof item.value === "object" && !Array.isArray(item.value) ? (item.value as RateLimitState) : {})]),
  );
  const userMap = new Map(users.map((user) => [user.id, user.username]));
  const globalKey = stateKey("global", "all");

  const userEntries = settings
    .filter((item) => item.key.startsWith(`${settingKeyPrefix}:user:`))
    .map((item) => {
      const userId = item.key.replace(`${settingKeyPrefix}:user:`, "");
      return {
        userId,
        username: userMap.get(userId) || null,
        ...toSnapshotItem(item.key, stateMap.get(item.key) || {}),
      };
    })
    .sort((a, b) => b.waitMs - a.waitMs);

  return {
    global: toSnapshotItem(globalKey, stateMap.get(globalKey) || {}),
    taskTypes: taskTypes.map((taskType) => ({
      taskType,
      ...toSnapshotItem(stateKey("taskType", taskType), stateMap.get(stateKey("taskType", taskType)) || {}),
    })),
    users: userEntries,
    updatedAt: new Date().toISOString(),
  };
}
