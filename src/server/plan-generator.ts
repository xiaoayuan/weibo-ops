import { getBusinessDateText, toBusinessDate, toBusinessDateTime } from "@/lib/business-date";
import { prisma } from "@/lib/prisma";

const DEFAULT_PLAN_START_TIME = "01:00";
const DEFAULT_PLAN_END_TIME = "18:00";
const PLAN_GENERATION_LOCK_TTL_MS = 10 * 60 * 1000;

type DailyPlanWithRelations = Awaited<ReturnType<typeof loadDailyPlans>>;

class PlanGenerationLockedError extends Error {
  constructor() {
    super("计划正在生成中，请稍后重试");
  }
}

async function loadDailyPlans(planDate: Date, ownerUserId?: string) {
  return prisma.dailyPlan.findMany({
    where: {
      planDate,
      ...(ownerUserId
        ? {
            account: {
              ownerUserId,
            },
          }
        : {}),
    },
    include: {
      account: true,
      content: true,
      task: {
        include: {
          superTopic: true,
        },
      },
    },
    orderBy: { scheduledTime: "asc" },
  });
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toDateAtTime(date: Date, time: string) {
  return toBusinessDateTime(getBusinessDateText(date), time);
}

function randomTimes(date: Date, startTime: string, endTime: string, count: number) {
  const start = toDateAtTime(date, startTime).getTime();
  const end = toDateAtTime(date, endTime).getTime();

  if (end <= start) {
    return Array.from({ length: count }, (_, index) => {
      const fallbackHour = Math.min(18, 1 + index);
      return toDateAtTime(date, `${String(fallbackHour).padStart(2, "0")}:00`);
    });
  }

  return Array.from({ length: count }, () => new Date(randomInt(start, end))).sort((left, right) => left.getTime() - right.getTime());
}

function randomTimesWithInterval(date: Date, startTime: string, endTime: string, count: number, minIntervalSec: number) {
  if (count <= 0) {
    return [] as Date[];
  }

  const start = toDateAtTime(date, startTime).getTime();
  const end = toDateAtTime(date, endTime).getTime();
  const minGapMs = Math.max(0, minIntervalSec) * 1000;

  if (end <= start) {
    return randomTimes(date, DEFAULT_PLAN_START_TIME, DEFAULT_PLAN_END_TIME, count);
  }

  const duration = end - start;
  const baseline = Array.from({ length: count }, (_, index) => start + Math.floor((duration * index) / Math.max(1, count)));
  const jitter = Math.floor(duration / Math.max(2, count * 2));
  const randomized = baseline.map((time) => time + randomInt(0, Math.max(0, jitter))).sort((a, b) => a - b);
  const fixed = randomized.map((value) => value);

  for (let index = 1; index < fixed.length; index += 1) {
    fixed[index] = Math.max(fixed[index], fixed[index - 1] + minGapMs);
  }

  for (let index = fixed.length - 2; index >= 0; index -= 1) {
    const latestAllowed = fixed[index + 1] - minGapMs;
    fixed[index] = Math.min(fixed[index], latestAllowed);
  }

  for (let index = 0; index < fixed.length; index += 1) {
    fixed[index] = Math.min(end, Math.max(start, fixed[index]));
  }

  return fixed.map((time) => new Date(time)).sort((left, right) => left.getTime() - right.getTime());
}

function pickRandomId(ids: string[]) {
  if (ids.length === 0) {
    return undefined;
  }

  return ids[randomInt(0, ids.length - 1)];
}

function buildPlanDedupeKey(taskId: string, dateText: string, planType: "CHECK_IN" | "FIRST_COMMENT" | "POST" | "LIKE" | "COMMENT" | "REPOST", slot: number) {
  return `${taskId}:${dateText}:${planType}:${slot}`;
}

async function acquirePlanGenerationLock(dateText: string, ownerUserId?: string) {
  const key = `plan-generation-lock:${ownerUserId || "global"}:${dateText}`;
  const now = new Date();

  try {
    await prisma.systemSetting.create({
      data: {
        key,
        value: {
          ownerUserId: ownerUserId || null,
          dateText,
          startedAt: now.toISOString(),
        },
      },
    });
  } catch {
    const existing = await prisma.systemSetting.findUnique({
      where: { key },
      select: { id: true, updatedAt: true },
    });

    if (!existing || now.getTime() - existing.updatedAt.getTime() <= PLAN_GENERATION_LOCK_TTL_MS) {
      throw new PlanGenerationLockedError();
    }

    await prisma.systemSetting.delete({ where: { id: existing.id } }).catch(() => null);

    try {
      await prisma.systemSetting.create({
        data: {
          key,
          value: {
            ownerUserId: ownerUserId || null,
            dateText,
            startedAt: now.toISOString(),
            replacedStaleLock: true,
          },
        },
      });
    } catch {
      throw new PlanGenerationLockedError();
    }
  }

  return async () => {
    await prisma.systemSetting.deleteMany({ where: { key } });
  };
}

export async function generateDailyPlans(dateText: string, ownerUserId?: string) {
  const result = await generateDailyPlansWithSummary(dateText, ownerUserId);
  return result.plans;
}

export async function generateDailyPlansWithSummary(
  dateText: string,
  ownerUserId?: string,
): Promise<{
  plans: DailyPlanWithRelations;
  createdCount: number;
  existingCount: number;
}> {
  const releaseLock = await acquirePlanGenerationLock(dateText, ownerUserId);
  const planDate = toBusinessDate(dateText);
  let createdCount = 0;
  let existingCount = 0;

  try {
    const [tasks, activeContents, existingPlansAll] = await Promise.all([
      prisma.accountTopicTask.findMany({
        where: {
          status: true,
          ...(ownerUserId
            ? {
                account: {
                  ownerUserId,
                },
              }
            : {}),
        },
        include: {
          superTopic: true,
          account: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.copywritingTemplate.findMany({
        where: {
          status: "ACTIVE",
        },
        select: {
          id: true,
        },
      }),
      prisma.dailyPlan.findMany({
        where: {
          planDate,
          ...(ownerUserId
            ? {
                account: {
                  ownerUserId,
                },
              }
            : {}),
        },
        select: {
          taskId: true,
          planType: true,
        },
      }),
    ]);

    let userExecuteStartTime: string | null = null;
    if (ownerUserId) {
      const user = await prisma.user.findUnique({
        where: { id: ownerUserId },
        select: { autoExecuteStartTime: true },
      });
      userExecuteStartTime = user?.autoExecuteStartTime || null;
    }

    const contentIds = activeContents.map((item) => item.id);

    // 按 taskId 分组现有计划，避免 N+1 查询
    const existingPlansByTask = new Map<string, Array<{ planType: string }>>();
    for (const plan of existingPlansAll) {
      if (!plan.taskId) continue;
      if (!existingPlansByTask.has(plan.taskId)) {
        existingPlansByTask.set(plan.taskId, []);
      }
      existingPlansByTask.get(plan.taskId)!.push({ planType: plan.planType });
    }

    for (const task of tasks) {
      const existingPlans = existingPlansByTask.get(task.id) || [];

      const checkInCount = existingPlans.filter((plan) => plan.planType === "CHECK_IN").length;
      const firstCommentCount = existingPlans.filter((plan) => plan.planType === "FIRST_COMMENT").length;
      const likeCount = existingPlans.filter((plan) => plan.planType === "LIKE").length;
      const commentCount = existingPlans.filter((plan) => plan.planType === "COMMENT").length;
      existingCount += existingPlans.length;

      const createPayload: Array<{
        taskId: string;
      accountId: string;
      dedupeKey: string;
      contentId?: string;
      planDate: Date;
      planType: "CHECK_IN" | "FIRST_COMMENT" | "POST" | "LIKE" | "COMMENT" | "REPOST";
        scheduledTime: Date;
        status: "PENDING";
        targetUrl?: string;
      }> = [];

      const effectiveStartTime = userExecuteStartTime && userExecuteStartTime > (task.startTime || DEFAULT_PLAN_START_TIME)
        ? userExecuteStartTime
        : (task.startTime || DEFAULT_PLAN_START_TIME);
      const endTime = task.endTime || DEFAULT_PLAN_END_TIME;
      const topicUrl = task.superTopic.topicUrl || "https://weibo.com/";

      if (task.signEnabled && checkInCount === 0) {
        createPayload.push({
          taskId: task.id,
          accountId: task.accountId,
          dedupeKey: buildPlanDedupeKey(task.id, dateText, "CHECK_IN", 0),
          planDate,
          planType: "CHECK_IN",
          scheduledTime: randomTimes(planDate, effectiveStartTime, endTime, 1)[0],
          status: "PENDING",
        });
      }

      if (task.firstCommentEnabled) {
        const target = Math.max(1, task.firstCommentPerDay || 4);
        const missingCount = Math.max(0, target - firstCommentCount);

        if (missingCount > 0) {
          const times = randomTimesWithInterval(planDate, effectiveStartTime, endTime, missingCount, task.firstCommentIntervalSec || 1800);

          for (const [index, scheduledTime] of times.entries()) {
            createPayload.push({
              taskId: task.id,
              accountId: task.accountId,
              dedupeKey: buildPlanDedupeKey(task.id, dateText, "FIRST_COMMENT", firstCommentCount + index),
              planDate,
              planType: "FIRST_COMMENT",
              scheduledTime,
              status: "PENDING",
            });
          }
        }
      }

      const likeTarget = Math.max(0, task.likePerDay || 0);
      const missingLike = Math.max(0, likeTarget - likeCount);

      if (missingLike > 0) {
        const times = randomTimesWithInterval(planDate, effectiveStartTime, endTime, missingLike, task.likeIntervalSec || 1200);

        for (const [index, scheduledTime] of times.entries()) {
          createPayload.push({
            taskId: task.id,
            accountId: task.accountId,
            dedupeKey: buildPlanDedupeKey(task.id, dateText, "LIKE", likeCount + index),
            planDate,
            planType: "LIKE",
            targetUrl: topicUrl,
            scheduledTime,
            status: "PENDING",
          });
        }
      }

      const commentTarget = Math.max(0, task.commentPerDay || 0);
      const missingComment = Math.max(0, commentTarget - commentCount);

      if (missingComment > 0 && contentIds.length > 0) {
        const times = randomTimesWithInterval(planDate, effectiveStartTime, endTime, missingComment, task.commentIntervalSec || 1800);

        for (const [index, scheduledTime] of times.entries()) {
          createPayload.push({
            taskId: task.id,
            accountId: task.accountId,
            dedupeKey: buildPlanDedupeKey(task.id, dateText, "COMMENT", commentCount + index),
            planDate,
            planType: "COMMENT",
            targetUrl: topicUrl,
            contentId: pickRandomId(contentIds),
            scheduledTime,
            status: "PENDING",
          });
        }
      }

      const repostTarget = Math.max(0, task.repostPerDay || 0);
      const repostCount = existingPlans.filter((plan) => plan.planType === "REPOST").length;
      const missingRepost = Math.max(0, repostTarget - repostCount);

      if (missingRepost > 0 && contentIds.length > 0) {
        const times = randomTimesWithInterval(planDate, effectiveStartTime, endTime, missingRepost, task.repostIntervalSec || 1800);

        for (const [index, scheduledTime] of times.entries()) {
          createPayload.push({
            taskId: task.id,
            accountId: task.accountId,
            dedupeKey: buildPlanDedupeKey(task.id, dateText, "REPOST", repostCount + index),
            planDate,
            planType: "REPOST",
            scheduledTime,
            status: "PENDING",
            contentId: pickRandomId(contentIds),
          });
        }
      }

      if (createPayload.length > 0) {
        const result = await prisma.dailyPlan.createMany({ data: createPayload, skipDuplicates: true });
        createdCount += result.count;
      }
    }

    return {
      plans: await loadDailyPlans(planDate, ownerUserId),
      createdCount,
      existingCount,
    };
  } finally {
    await releaseLock();
  }
}

export { PlanGenerationLockedError };
