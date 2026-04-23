import { toBusinessDate } from "@/lib/business-date";
import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";

type DailyPlanWithRelations = Awaited<ReturnType<typeof loadDailyPlans>>;

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
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function randomTimes(date: Date, startTime: string, endTime: string, count: number) {
  const start = toDateAtTime(date, startTime).getTime();
  const end = toDateAtTime(date, endTime).getTime();

  if (end <= start) {
    return Array.from({ length: count }, (_, index) => {
      const fallback = new Date(date);
      fallback.setHours(9 + index, 0, 0, 0);
      return fallback;
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
    return randomTimes(date, "09:00", "22:00", count);
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
  const planDate = toBusinessDate(dateText);
  let createdCount = 0;
  let existingCount = 0;

  const [tasks, activeContents] = await Promise.all([
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
  ]);

  const contentIds = activeContents.map((item) => item.id);

  for (const task of tasks) {
    const existingPlans = await prisma.dailyPlan.findMany({
      where: {
        taskId: task.id,
        planDate,
      },
      select: {
        planType: true,
      },
    });

    const checkInCount = existingPlans.filter((plan) => plan.planType === "CHECK_IN").length;
    const firstCommentCount = existingPlans.filter((plan) => plan.planType === "FIRST_COMMENT").length;
    const likeCount = existingPlans.filter((plan) => plan.planType === "LIKE").length;
    const commentCount = existingPlans.filter((plan) => plan.planType === "COMMENT").length;
    const postCount = existingPlans.filter((plan) => plan.planType === "POST").length;
    existingCount += existingPlans.length;

    const createPayload: Array<{
      taskId: string;
      accountId: string;
      contentId?: string;
      planDate: Date;
      planType: "CHECK_IN" | "FIRST_COMMENT" | "POST" | "LIKE" | "COMMENT";
      scheduledTime: Date;
      status: "PENDING";
      targetUrl?: string;
    }> = [];

    const startTime = task.startTime || "09:00";
    const endTime = task.endTime || "22:00";
    const topicUrl = task.superTopic.topicUrl || "https://weibo.com/";

    if (task.signEnabled && checkInCount === 0) {
      createPayload.push({
        taskId: task.id,
        accountId: task.accountId,
        planDate,
        planType: "CHECK_IN",
        scheduledTime: randomTimes(planDate, startTime, endTime, 1)[0],
        status: "PENDING",
      });
    }

    if (task.firstCommentEnabled) {
      const target = Math.max(1, task.firstCommentPerDay || 4);
      const missingCount = Math.max(0, target - firstCommentCount);

      if (missingCount > 0) {
        const times = randomTimesWithInterval(planDate, startTime, endTime, missingCount, task.firstCommentIntervalSec || 1800);

        for (const scheduledTime of times) {
          createPayload.push({
            taskId: task.id,
            accountId: task.accountId,
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
      const times = randomTimesWithInterval(planDate, startTime, endTime, missingLike, task.likeIntervalSec || 1200);

      for (const scheduledTime of times) {
        createPayload.push({
          taskId: task.id,
          accountId: task.accountId,
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

    if (missingComment > 0) {
      const times = randomTimesWithInterval(planDate, startTime, endTime, missingComment, task.commentIntervalSec || 1800);

      for (const scheduledTime of times) {
        createPayload.push({
          taskId: task.id,
          accountId: task.accountId,
          planDate,
          planType: "COMMENT",
          targetUrl: topicUrl,
          contentId: pickRandomId(contentIds),
          scheduledTime,
          status: "PENDING",
        });
      }
    }

    const repostTargetByNewRule = Math.max(0, task.repostPerDay || 0);
    const repostTargetByLegacyRule = task.postEnabled
      ? randomInt(task.minPostsPerDay || 0, Math.max(task.minPostsPerDay || 0, task.maxPostsPerDay || 0))
      : 0;
    const postTarget = repostTargetByNewRule > 0 ? repostTargetByNewRule : repostTargetByLegacyRule;
    const missingPost = Math.max(0, postTarget - postCount);

    if (missingPost > 0) {
      const times = randomTimesWithInterval(planDate, startTime, endTime, missingPost, task.repostIntervalSec || 1800);

      for (const scheduledTime of times) {
        createPayload.push({
          taskId: task.id,
          accountId: task.accountId,
          planDate,
          planType: "POST",
          contentId: pickRandomId(contentIds),
          scheduledTime,
          status: "PENDING",
        });
      }
    }

    if (createPayload.length > 0) {
      await prisma.dailyPlan.createMany({
        data: createPayload,
      });
      createdCount += createPayload.length;

      await writeExecutionLog({
        accountId: task.accountId,
        actionType: "PLAN_GENERATED",
        requestPayload: { taskId: task.id, date: dateText },
        responsePayload: { count: createPayload.length },
        success: true,
      });
    }
  }

  return {
    plans: await loadDailyPlans(planDate, ownerUserId),
    createdCount,
    existingCount,
  };
}
