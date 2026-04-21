import { getBusinessDateText, toBusinessDate } from "@/lib/business-date";
import { generateDailyPlans } from "@/server/plan-generator";
import { executePlanById } from "@/server/plans/execute-plan";
import { writeExecutionLog } from "@/server/logs";
import { prisma } from "@/lib/prisma";
import { scheduleTask } from "@/server/task-scheduler";

const AUTO_FIRST_COMMENT_ENABLED = process.env.AUTO_FIRST_COMMENT_ENABLED !== "false";
const AUTO_FIRST_COMMENT_HOUR = Number(process.env.AUTO_FIRST_COMMENT_HOUR || 1);
const AUTO_FIRST_COMMENT_MINUTE = Number(process.env.AUTO_FIRST_COMMENT_MINUTE || 5);

declare global {
  var __firstCommentSchedulerStarted: boolean | undefined;
}

function getNextRunAt(now: Date) {
  const next = new Date(now);
  next.setHours(AUTO_FIRST_COMMENT_HOUR, AUTO_FIRST_COMMENT_MINUTE, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

async function runAutoFirstCommentOnce() {
  const now = new Date();
  const dateText = getBusinessDateText(now);
  const planDate = toBusinessDate(dateText);

  await generateDailyPlans(dateText);

  const candidates = await prisma.dailyPlan.findMany({
    where: {
      planDate,
      planType: "FIRST_COMMENT",
      status: {
        in: ["PENDING", "READY"],
      },
    },
    orderBy: {
      scheduledTime: "asc",
    },
    select: {
      id: true,
      account: {
        select: {
          ownerUserId: true,
        },
      },
    },
  });

  let success = 0;
  let failed = 0;

  for (const plan of candidates) {
    if (!plan.account.ownerUserId) {
      failed += 1;
      continue;
    }

    const scheduled = await scheduleTask({
      kind: "PLAN",
      id: plan.id,
      ownerUserId: plan.account.ownerUserId,
      label: `auto-first-comment:${plan.id}`,
      run: () => executePlanById(plan.id),
    });
    const result = scheduled.data;

    if (result.ok && result.success) {
      success += 1;
    } else {
      failed += 1;
    }
  }

  await writeExecutionLog({
    actionType: "AUTO_FIRST_COMMENT_DAILY_RUN",
    requestPayload: {
      date: dateText,
      hour: AUTO_FIRST_COMMENT_HOUR,
      minute: AUTO_FIRST_COMMENT_MINUTE,
    },
    responsePayload: {
      total: candidates.length,
      success,
      failed,
    },
    success: failed === 0,
    errorMessage: failed > 0 ? `自动首评完成，失败 ${failed} 条` : undefined,
  });
}

function scheduleNext() {
  const now = new Date();
  const nextRunAt = getNextRunAt(now);
  const delay = nextRunAt.getTime() - now.getTime();

  setTimeout(async () => {
    try {
      await runAutoFirstCommentOnce();
    } catch (error) {
      await writeExecutionLog({
        actionType: "AUTO_FIRST_COMMENT_DAILY_RUN",
        requestPayload: {
          hour: AUTO_FIRST_COMMENT_HOUR,
          minute: AUTO_FIRST_COMMENT_MINUTE,
        },
        success: false,
        errorMessage: error instanceof Error ? error.message : "自动首评执行异常",
      });
    } finally {
      scheduleNext();
    }
  }, delay);
}

export function ensureFirstCommentSchedulerStarted() {
  if (!AUTO_FIRST_COMMENT_ENABLED) {
    return;
  }

  if (globalThis.__firstCommentSchedulerStarted) {
    return;
  }

  globalThis.__firstCommentSchedulerStarted = true;
  scheduleNext();
}
