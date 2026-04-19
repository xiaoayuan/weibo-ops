import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";

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

  return Array.from({ length: count }, () => new Date(randomInt(start, end))).sort(
    (left, right) => left.getTime() - right.getTime(),
  );
}

export async function generateDailyPlans(dateText: string) {
  const planDate = new Date(`${dateText}T00:00:00`);

  const tasks = await prisma.accountTopicTask.findMany({
    where: { status: true },
    include: {
      superTopic: true,
      account: true,
    },
    orderBy: { createdAt: "desc" },
  });

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

    const hasCheckInPlan = existingPlans.some((plan) => plan.planType === "CHECK_IN");
    const firstCommentPlanCount = existingPlans.filter((plan) => plan.planType === "FIRST_COMMENT").length;

    const createPayload: Array<{
      taskId: string;
      accountId: string;
      contentId?: string;
      planDate: Date;
      planType: "CHECK_IN" | "FIRST_COMMENT" | "POST";
      scheduledTime: Date;
      status: "PENDING";
    }> = [];

    const startTime = task.startTime || "09:00";
    const endTime = task.endTime || "22:00";

    if (task.signEnabled && !hasCheckInPlan) {
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
      const targetCount = Math.max(1, task.firstCommentPerDay || 4);
      const missingCount = Math.max(0, targetCount - firstCommentPlanCount);

      if (missingCount > 0) {
        const times = randomTimes(planDate, startTime, endTime, missingCount);

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

    if (createPayload.length > 0) {
      await prisma.dailyPlan.createMany({
        data: createPayload,
      });

      await writeExecutionLog({
        accountId: task.accountId,
        actionType: "PLAN_GENERATED",
        requestPayload: { taskId: task.id, date: dateText },
        responsePayload: { count: createPayload.length },
        success: true,
      });
    }
  }

  return prisma.dailyPlan.findMany({
    where: { planDate },
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
