import { prisma } from "@/lib/prisma";
import { runCommentLikeJob, runRepostRotationJob } from "@/server/action-jobs/runner";
import { getActionJobNodeRole, getCurrentNodeId } from "@/server/action-job-nodes";

declare global {
  var __actionJobDispatcherStarted: boolean | undefined;
}

const POLL_INTERVAL_MS = 5_000;
const MAX_CONSECUTIVE_ERRORS = 10;

function shouldRunDispatcher() {
  return getActionJobNodeRole() === "controller" || getActionJobNodeRole() === "worker";
}

/** 记录连续错误计数，达到阈值后暂停调度 */
let __consecutiveErrorCount = 0;
let __dispatcherPausedUntil: number | 0 = 0;

function recordDispatchError() {
  __consecutiveErrorCount++;
  if (__consecutiveErrorCount >= MAX_CONSECUTIVE_ERRORS) {
    // 暂停 5 分钟，避免持续空转
    __dispatcherPausedUntil = Date.now() + 5 * 60 * 1000;
    __consecutiveErrorCount = 0;
    console.warn(`[dispatcher] 连续 ${MAX_CONSECUTIVE_ERRORS} 次失败，已暂停调度 5 分钟`);
  }
}

function recordDispatchSuccess() {
  __consecutiveErrorCount = 0;
}

async function claimNextActionJob(nodeId: string) {
  const jobs = await prisma.actionJob.findMany({
    where: {
      status: "PENDING",
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: {
      id: true,
      jobType: true,
      config: true,
      createdBy: true,
    },
  });

  for (const job of jobs) {
    const config = job.config && typeof job.config === "object" && !Array.isArray(job.config) ? (job.config as Record<string, unknown>) : {};
    if ((config.targetNodeId as string | undefined) !== nodeId) {
      continue;
    }

    const earliestStartAt = typeof config.earliestStartAt === "string" ? new Date(config.earliestStartAt) : null;
    if (earliestStartAt && earliestStartAt.getTime() > Date.now()) {
      continue;
    }

    const updated = await prisma.actionJob.updateMany({
      where: {
        id: job.id,
        status: "PENDING",
      },
      data: {
        status: "RUNNING",
        summary: {
          ...(config.scheduleDecision && typeof config.scheduleDecision === "object" ? { scheduleDecision: config.scheduleDecision } : {}),
          claimedByNodeId: nodeId,
          claimedAt: new Date().toISOString(),
        },
      },
    });

    if (updated.count === 1) {
      return { job, config };
    }
  }

  return null;
}

async function dispatchOnce() {
  // 暂停期间跳过调度
  if (__dispatcherPausedUntil > 0 && Date.now() < __dispatcherPausedUntil) {
    return;
  }

  const nodeId = getCurrentNodeId();
  const claimed = await claimNextActionJob(nodeId);

  if (!claimed) {
    recordDispatchSuccess();
    return;
  }

  const { job, config } = claimed;

  try {
    if (job.jobType === "COMMENT_LIKE_BATCH") {
      const poolItems = Array.isArray(config.poolItemIds)
        ? await prisma.commentLinkPoolItem.findMany({
            where: { id: { in: config.poolItemIds.filter((item): item is string => typeof item === "string") } },
            select: { id: true, sourceUrl: true },
            orderBy: { createdAt: "desc" },
          })
        : [];

      await runCommentLikeJob({
        jobId: job.id,
        ownerUserId: job.createdBy || "system",
        accountIds: Array.isArray(config.accountIds) ? config.accountIds.filter((item): item is string => typeof item === "string") : [],
        poolItems,
        urgency: (config.urgency as "S" | "A" | "B" | undefined) || "S",
      });
      recordDispatchSuccess();
      return;
    }

    if (job.jobType === "REPOST_ROTATION") {
      await runRepostRotationJob({
        jobId: job.id,
        ownerUserId: job.createdBy || "system",
        accountIds: Array.isArray(config.accountIds) ? config.accountIds.filter((item): item is string => typeof item === "string") : [],
        targetUrl: typeof config.targetUrl === "string" ? config.targetUrl : "",
        times: typeof config.times === "number" ? config.times : 1,
        intervalSec: toIntervalSec(config.intervalSec),
        urgency: (config.urgency as "S" | "A" | "B" | undefined) || "S",
      });
      recordDispatchSuccess();
    }
  } catch (error) {
    recordDispatchError();
    await prisma.actionJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        summary: {
          claimedByNodeId: nodeId,
          claimedAt: new Date().toISOString(),
          dispatchError: error instanceof Error ? error.message : "action-job-dispatch-failed",
        },
      },
    });
  }
}

function scheduleLoop() {
  void dispatchOnce().finally(() => {
    setTimeout(scheduleLoop, POLL_INTERVAL_MS);
  });
}

export function ensureActionJobDispatcherStarted() {
  if (!shouldRunDispatcher()) {
    return;
  }

  if (globalThis.__actionJobDispatcherStarted) {
    return;
  }

  globalThis.__actionJobDispatcherStarted = true;
  scheduleLoop();
}
function toIntervalSec(value: unknown): 0 | 3 | 5 | 10 {
  return value === 0 || value === 3 || value === 5 || value === 10 ? value : 3;
}
