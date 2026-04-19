import { generateDailyPlans } from "@/server/plan-generator";
import { executePlanById } from "@/server/plans/execute-plan";
import { writeExecutionLog } from "@/server/logs";
import { prisma } from "@/lib/prisma";

const AUTO_FIRST_COMMENT_ENABLED = process.env.AUTO_FIRST_COMMENT_ENABLED !== "false";
const AUTO_FIRST_COMMENT_HOUR = Number(process.env.AUTO_FIRST_COMMENT_HOUR || 1);
const AUTO_FIRST_COMMENT_MINUTE = Number(process.env.AUTO_FIRST_COMMENT_MINUTE || 5);

declare global {
  var __firstCommentSchedulerStarted: boolean | undefined;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const dateText = formatDate(now);
  const planDate = new Date(`${dateText}T00:00:00`);

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
    },
  });

  let success = 0;
  let failed = 0;

  for (const plan of candidates) {
    const result = await executePlanById(plan.id);

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
