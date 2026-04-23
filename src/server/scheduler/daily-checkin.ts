import { getBusinessDateText } from "@/lib/business-date";
import { generateDailyPlans } from "@/server/plan-generator";
import { executePlanById } from "@/server/plans/execute-plan";
import { writeExecutionLog } from "@/server/logs";
import { taskTierToLane } from "@/server/task-scheduler/rate-limit";
import { scheduleTask } from "@/server/task-scheduler";

const AUTO_CHECKIN_ENABLED = process.env.AUTO_CHECKIN_ENABLED !== "false";
const AUTO_CHECKIN_HOUR = Number(process.env.AUTO_CHECKIN_HOUR || 6);
const AUTO_CHECKIN_MINUTE = Number(process.env.AUTO_CHECKIN_MINUTE || 0);

declare global {
  var __dailyCheckinSchedulerStarted: boolean | undefined;
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
  const dateText = getBusinessDateText(now);

  const generated = await generateDailyPlans(dateText);
  const checkInPlans = generated.filter((plan) => plan.planType === "CHECK_IN" && (plan.status === "PENDING" || plan.status === "READY"));

  let success = 0;
  let failed = 0;

  for (const plan of checkInPlans) {
    if (!plan.account.ownerUserId) {
      failed += 1;
      continue;
    }

    const scheduled = await scheduleTask({
      kind: "PLAN",
      id: plan.id,
      ownerUserId: plan.account.ownerUserId,
      label: `auto-checkin:${plan.id}`,
      lane: taskTierToLane("B"),
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
