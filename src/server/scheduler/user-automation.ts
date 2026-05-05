import { formatBusinessHm, getBusinessDateText, toBusinessDate } from "@/lib/business-date";
import { prisma } from "@/lib/prisma";
import { getActionJobNodeRole } from "@/server/action-job-nodes";
import { writeExecutionLog } from "@/server/logs";
import { generateDailyPlansWithSummary } from "@/server/plan-generator";
import { executePlanById } from "@/server/plans/execute-plan";
import { taskTierToLane } from "@/server/task-scheduler/rate-limit";
import { scheduleTask } from "@/server/task-scheduler";

declare global {
  var __userAutomationSchedulerStarted: boolean | undefined;
  var __autoExecuteInFlightPlanIds: Set<string> | undefined;
}

function getAutoExecuteInFlightPlanIds() {
  if (!globalThis.__autoExecuteInFlightPlanIds) {
    globalThis.__autoExecuteInFlightPlanIds = new Set<string>();
  }

  return globalThis.__autoExecuteInFlightPlanIds;
}

function toHm(date: Date) {
  return formatBusinessHm(date);
}

function isAfterOrEqualHm(left: string, right: string) {
  return left >= right;
}

function parseHmToMinutes(hm: string) {
  const matched = hm.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!matched) {
    return null;
  }

  return Number(matched[1]) * 60 + Number(matched[2]);
}

function stableHash(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function toHmFromMinutes(totalMinutes: number) {
  const hour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minute = String(totalMinutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

async function runAutoGenerate(now: Date) {
  const hm = toHm(now);
  const dateText = getBusinessDateText(now);

  const users = await prisma.user.findMany({
    where: {
      autoGenerateEnabled: true,
    },
    select: {
      id: true,
      username: true,
      autoGenerateWindowStart: true,
      autoGenerateWindowEnd: true,
    },
  });

  for (const user of users) {
    const startMinutes = parseHmToMinutes(user.autoGenerateWindowStart);
    const endMinutes = parseHmToMinutes(user.autoGenerateWindowEnd);
    const nowMinutes = parseHmToMinutes(hm);

    if (startMinutes === null || endMinutes === null || nowMinutes === null || startMinutes >= endMinutes) {
      continue;
    }

    if (nowMinutes < startMinutes || nowMinutes > endMinutes) {
      continue;
    }

    const triggerMinutes = startMinutes + (stableHash(`${user.id}:${dateText}`) % (endMinutes - startMinutes + 1));

    if (nowMinutes < triggerMinutes) {
      continue;
    }

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
          windowStart: user.autoGenerateWindowStart,
          windowEnd: user.autoGenerateWindowEnd,
          triggerTime: toHmFromMinutes(triggerMinutes),
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
          windowStart: user.autoGenerateWindowStart,
          windowEnd: user.autoGenerateWindowEnd,
          triggerTime: toHmFromMinutes(triggerMinutes),
        },
        success: false,
        errorMessage: error instanceof Error ? error.message : "自动生成计划失败",
      });
    }
  }
}

async function runAutoExecute(now: Date) {
  const inFlightPlanIds = getAutoExecuteInFlightPlanIds();
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
      autoExecuteEndTime: true,
    },
  });

  for (const user of users) {
    if (!isAfterOrEqualHm(hm, user.autoExecuteStartTime) || hm > user.autoExecuteEndTime) {
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

    console.log("[scheduler] runAutoExecute found", candidates.length, "candidates for user", user.id);

    const queueablePlans = candidates.filter((item) => !inFlightPlanIds.has(item.id)).slice(0, 3);

    if (queueablePlans.length === 0) {
      continue;
    }

    const ids = queueablePlans.map((item) => item.id);
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
        status: "PENDING",
        resultMessage: "自动调度已入队",
      },
    });

    for (const plan of queueablePlans) {
      inFlightPlanIds.add(plan.id);
      void scheduleTask({
        kind: "PLAN",
        id: plan.id,
        ownerUserId: user.id,
        label: `auto-plan:${plan.id}`,
        lane: taskTierToLane("B"),
        run: () => executePlanById(plan.id, user.id),
      }).catch(async (error) => {
        const message = error instanceof Error ? error.message : "自动执行入队失败";
        const isNetworkError = message.includes("ECONNRESET") || message.includes("ECONNREFUSED")
          || message.includes("ETIMEDOUT") || message.includes("EPIPE")
          || message.includes("ssl") || message.includes("SSL")
          || message.includes("TLS") || message.includes("socket disconnect")
          || message.includes("network socket");
        const isNoTarget = message.includes("未命中") || message.includes("未找到");

        const friendlyMsg = isNetworkError ? "网络波动，稍后自动重试"
          : isNoTarget ? "暂未命中首评帖子，稍后自动重试"
          : message;

        const retryable = isNetworkError || isNoTarget;

        if (retryable) {
          const planBeforeRetry = await prisma.dailyPlan.findUnique({ where: { id: plan.id }, select: { resultMessage: true, scheduledTime: true, planDate: true } });
          const isToday = planBeforeRetry?.planDate && new Date(planBeforeRetry.planDate).toDateString() === new Date().toDateString();

          if (!isToday) {
            await prisma.dailyPlan.update({
              where: { id: plan.id },
              data: { status: "FAILED", resultMessage: "历史计划已过期，不再重试" },
            });
            return;
          }
          const prevMsg = planBeforeRetry?.resultMessage || "";
          const retryCount = (prevMsg.match(/第(\d+)次/g) || []).length + 1;
          const maxRetries = isNetworkError ? 3 : 2;

          if (retryCount <= maxRetries) {
            const delayMinutes = isNetworkError ? 5 : 15;
            const retryDelay = delayMinutes * 60 * 1000;
            await prisma.dailyPlan.update({
              where: { id: plan.id },
              data: {
                status: "PENDING",
                scheduledTime: new Date(Date.now() + retryDelay),
                resultMessage: `${friendlyMsg}（第${retryCount}次重试，${delayMinutes}分钟后）`,
              },
            });
            await writeExecutionLog({
              accountId: plan.accountId,
              planId: plan.id,
              actionType: "PLAN_EXECUTE_REQUEUED",
              requestPayload: { trigger: "auto_retry", retryCount, maxRetries },
              success: false,
              errorMessage: friendlyMsg,
            });
            return;
          }
        }

        await prisma.dailyPlan.update({
          where: { id: plan.id },
          data: { status: "FAILED", resultMessage: message },
        });

        await writeExecutionLog({
          accountId: plan.accountId,
          planId: plan.id,
          actionType: "PLAN_EXECUTE_FAILED",
          requestPayload: { trigger: "auto_schedule", planId: plan.id },
          success: false,
          errorMessage: message,
        });
      }).finally(() => {
        inFlightPlanIds.delete(plan.id);
      });
    }

    await writeExecutionLog({
      userId: user.id,
      actionType: "PLAN_SCHEDULED",
      requestPayload: {
        trigger: "AUTO_DAILY_EXECUTE",
        date: dateText,
        time: hm,
        windowStart: user.autoExecuteStartTime,
        windowEnd: user.autoExecuteEndTime,
      },
      responsePayload: {
        queuedCount: queueablePlans.length,
      },
      success: true,
    });
  }
}

async function cleanupStuckPlans() {
  const result = await prisma.dailyPlan.updateMany({
    where: {
      status: "RUNNING",
      updatedAt: {
        lt: new Date(Date.now() - 20 * 60 * 1000),
      },
    },
    data: {
      status: "FAILED",
      resultMessage: "执行超时（超过 20 分钟未更新，已自动重置）",
    },
  });

  if (result.count > 0) {
    console.log("[scheduler] cleaned up", result.count, "stuck RUNNING plans");
  }
}

function scheduleNext() {
  setTimeout(async () => {
    const now = new Date();
    console.log("[scheduler] tick at", now.toISOString());

    try {
      await cleanupStuckPlans();
      await runAutoGenerate(now);
      await runAutoExecute(now);
    } finally {
      scheduleNext();
    }
  }, 30_000);
}

export function ensureUserAutomationSchedulerStarted() {
  const role = getActionJobNodeRole();
  console.log("[scheduler] ensureUserAutomationSchedulerStarted called, role:", role, "started:", globalThis.__userAutomationSchedulerStarted);

  if (role !== "controller") {
    return;
  }

  if (globalThis.__userAutomationSchedulerStarted) {
    return;
  }

  globalThis.__userAutomationSchedulerStarted = true;
  console.log("[scheduler] starting scheduler loop");
  scheduleNext();
}
