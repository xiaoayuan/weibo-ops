import { getBusinessDateText, toBusinessDate } from "@/lib/business-date";
import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";
import { generateDailyPlansWithSummary } from "@/server/plan-generator";
import { executePlanById } from "@/server/plans/execute-plan";
import { scheduleTask } from "@/server/task-scheduler";

declare global {
  var __userAutomationSchedulerStarted: boolean | undefined;
}

function toHm(date: Date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function isAfterOrEqualHm(left: string, right: string) {
  return left >= right;
}

async function runAutoGenerate(now: Date) {
  const hm = toHm(now);
  const dateText = getBusinessDateText(now);

  const users = await prisma.user.findMany({
    where: {
      autoGenerateEnabled: true,
      autoGenerateTime: hm,
    },
    select: {
      id: true,
      username: true,
    },
  });

  for (const user of users) {
    const lockKey = `auto-generate:${user.id}:${dateText}`;
    const lockExists = await prisma.systemSetting.findUnique({ where: { key: lockKey }, select: { id: true } });

    if (lockExists) {
      continue;
    }

    try {
      const result = await generateDailyPlansWithSummary(dateText, user.id);

      await prisma.systemSetting.create({
        data: {
          key: lockKey,
          value: {
            generatedAt: now.toISOString(),
            createdCount: result.createdCount,
            existingCount: result.existingCount,
          },
        },
      });

      await writeExecutionLog({
        userId: user.id,
        actionType: "PLAN_GENERATED",
        requestPayload: {
          trigger: "AUTO_DAILY_GENERATE",
          date: dateText,
          time: hm,
        },
        responsePayload: {
          createdCount: result.createdCount,
          existingCount: result.existingCount,
        },
        success: true,
      });
    } catch (error) {
      await writeExecutionLog({
        userId: user.id,
        actionType: "PLAN_GENERATED",
        requestPayload: {
          trigger: "AUTO_DAILY_GENERATE",
          date: dateText,
          time: hm,
        },
        success: false,
        errorMessage: error instanceof Error ? error.message : "自动生成计划失败",
      });
    }
  }
}

async function runAutoExecute(now: Date) {
  const hm = toHm(now);
  const dateText = getBusinessDateText(now);
  const planDate = toBusinessDate(dateText);

  const users = await prisma.user.findMany({
    where: {
      autoExecuteEnabled: true,
    },
    select: {
      id: true,
      autoExecuteStartTime: true,
    },
  });

  for (const user of users) {
    if (!isAfterOrEqualHm(hm, user.autoExecuteStartTime)) {
      continue;
    }

    const candidates = await prisma.dailyPlan.findMany({
      where: {
        planDate,
        scheduledTime: {
          lte: now,
        },
        status: {
          in: ["PENDING", "READY"],
        },
        account: {
          ownerUserId: user.id,
        },
      },
      select: {
        id: true,
        accountId: true,
      },
      orderBy: {
        scheduledTime: "asc",
      },
      take: 100,
    });

    if (candidates.length === 0) {
      continue;
    }

    const ids = candidates.map((item) => item.id);
    await prisma.dailyPlan.updateMany({
      where: {
        id: {
          in: ids,
        },
        status: {
          in: ["PENDING", "READY"],
        },
      },
      data: {
        status: "RUNNING",
        resultMessage: "自动调度已入队",
      },
    });

    for (const plan of candidates) {
      void scheduleTask({
        kind: "PLAN",
        id: plan.id,
        ownerUserId: user.id,
        label: `auto-plan:${plan.id}`,
        run: () => executePlanById(plan.id, user.id),
      }).catch(async (error) => {
        await prisma.dailyPlan.update({
          where: { id: plan.id },
          data: {
            status: "FAILED",
            resultMessage: error instanceof Error ? error.message : "自动执行入队失败",
          },
        });
      });
    }

    await writeExecutionLog({
      userId: user.id,
      actionType: "PLAN_SCHEDULED",
      requestPayload: {
        trigger: "AUTO_DAILY_EXECUTE",
        date: dateText,
        time: hm,
      },
      responsePayload: {
        queuedCount: candidates.length,
      },
      success: true,
    });
  }
}

function scheduleNext() {
  setTimeout(async () => {
    const now = new Date();

    try {
      await runAutoGenerate(now);
      await runAutoExecute(now);
    } finally {
      scheduleNext();
    }
  }, 30_000);
}

export function ensureUserAutomationSchedulerStarted() {
  if (globalThis.__userAutomationSchedulerStarted) {
    return;
  }

  globalThis.__userAutomationSchedulerStarted = true;
  scheduleNext();
}
