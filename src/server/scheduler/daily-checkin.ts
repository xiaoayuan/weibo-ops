import { generateDailyPlans } from "@/server/plan-generator";
import { executePlanById } from "@/server/plans/execute-plan";
import { writeExecutionLog } from "@/server/logs";

const AUTO_CHECKIN_ENABLED = process.env.AUTO_CHECKIN_ENABLED !== "false";
const AUTO_CHECKIN_HOUR = Number(process.env.AUTO_CHECKIN_HOUR || 6);
const AUTO_CHECKIN_MINUTE = Number(process.env.AUTO_CHECKIN_MINUTE || 0);

declare global {
  var __dailyCheckinSchedulerStarted: boolean | undefined;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextRunAt(now: Date) {
  const next = new Date(now);
  next.setHours(AUTO_CHECKIN_HOUR, AUTO_CHECKIN_MINUTE, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

async function runAutoCheckInOnce() {
  const now = new Date();
  const dateText = formatDate(now);

  const generated = await generateDailyPlans(dateText);
  const checkInPlans = generated.filter((plan) => plan.planType === "CHECK_IN" && (plan.status === "PENDING" || plan.status === "READY"));

  let success = 0;
  let failed = 0;

  for (const plan of checkInPlans) {
    const result = await executePlanById(plan.id);

    if (result.ok && result.success) {
      success += 1;
    } else {
      failed += 1;
    }
  }

  await writeExecutionLog({
    actionType: "AUTO_CHECKIN_DAILY_RUN",
    requestPayload: {
      date: dateText,
      hour: AUTO_CHECKIN_HOUR,
      minute: AUTO_CHECKIN_MINUTE,
    },
    responsePayload: {
      total: checkInPlans.length,
      success,
      failed,
    },
    success: failed === 0,
    errorMessage: failed > 0 ? `自动签到完成，失败 ${failed} 条` : undefined,
  });
}

function scheduleNext() {
  const now = new Date();
  const nextRunAt = getNextRunAt(now);
  const delay = nextRunAt.getTime() - now.getTime();

  setTimeout(async () => {
    try {
      await runAutoCheckInOnce();
    } catch (error) {
      await writeExecutionLog({
        actionType: "AUTO_CHECKIN_DAILY_RUN",
        requestPayload: {
          hour: AUTO_CHECKIN_HOUR,
          minute: AUTO_CHECKIN_MINUTE,
        },
        success: false,
        errorMessage: error instanceof Error ? error.message : "自动签到执行异常",
      });
    } finally {
      scheduleNext();
    }
  }, delay);
}

export function ensureDailyCheckinSchedulerStarted() {
  if (!AUTO_CHECKIN_ENABLED) {
    return;
  }

  if (globalThis.__dailyCheckinSchedulerStarted) {
    return;
  }

  globalThis.__dailyCheckinSchedulerStarted = true;
  scheduleNext();
}
