import type { ActionJobStep as PrismaActionJobStep } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getExecutor } from "@/server/executors";
import { writeExecutionLog } from "@/server/logs";
import { attachRiskMetaToPayload, classifyAndApplyAccountRisk } from "@/server/risk/account-risk";
import { isAccountCircuitOpen, isProxyCircuitOpen, recordExecutionOutcome } from "@/server/risk/circuit-breaker";
import { getExecutionStrategy, type ExecutionStrategy } from "@/server/strategy/config";
import { waitForAccountExecutionWindow } from "@/server/task-scheduler/account-timing";

type StartCommentLikeJobInput = {
  jobId: string;
  ownerUserId: string;
  accountIds: string[];
  poolItems: Array<{ id: string; sourceUrl: string }>;
  urgency?: "S" | "A" | "B";
};

type StartRepostRotationJobInput = {
  jobId: string;
  ownerUserId: string;
  accountIds: string[];
  targetUrl: string;
  times: number;
  intervalSec: 0 | 3 | 5 | 10;
  urgency?: "S" | "A" | "B";
};

type SlaSummary = {
  urgency: "S" | "A" | "B";
  targetMinutes: number;
  limitMinutes: number;
  withinTargetAccounts: number;
  withinLimitAccounts: number;
  overtimeAccounts: number;
  measuredAccounts: number;
};

type WaveRule = {
  ratios: [number, number, number];
  windowsSec: [number, number, number];
};

function getWaveRule(strategy: ExecutionStrategy, urgency: "S" | "A" | "B"): WaveRule {
  const config = strategy.actionJob.urgency[urgency];

  return {
    ratios: config.waveRatios,
    windowsSec: config.waveWindowsSec,
  };
}

async function computeJobSlaSummary(jobId: string, urgency: "S" | "A" | "B", strategy: ExecutionStrategy): Promise<SlaSummary> {
  const thresholds = strategy.actionJob.urgency[urgency];
  const steps = await prisma.actionJobStep.findMany({
    where: { jobId },
    select: {
      accountId: true,
      startedAt: true,
      finishedAt: true,
    },
  });

  const accountRange = new Map<string, { start: number; end: number }>();

  for (const step of steps) {
    if (!step.startedAt || !step.finishedAt) {
      continue;
    }

    const startTs = step.startedAt.getTime();
    const endTs = step.finishedAt.getTime();
    const current = accountRange.get(step.accountId);

    if (!current) {
      accountRange.set(step.accountId, { start: startTs, end: endTs });
      continue;
    }

    current.start = Math.min(current.start, startTs);
    current.end = Math.max(current.end, endTs);
    accountRange.set(step.accountId, current);
  }

  let withinTargetAccounts = 0;
  let withinLimitAccounts = 0;
  let overtimeAccounts = 0;

  for (const range of accountRange.values()) {
    const costSec = Math.max(0, Math.floor((range.end - range.start) / 1000));

    if (costSec <= thresholds.targetSlaSec) {
      withinTargetAccounts += 1;
      withinLimitAccounts += 1;
      continue;
    }

    if (costSec <= thresholds.limitSlaSec) {
      withinLimitAccounts += 1;
      continue;
    }

    overtimeAccounts += 1;
  }

  return {
    urgency,
    targetMinutes: Math.floor(thresholds.targetSlaSec / 60),
    limitMinutes: Math.floor(thresholds.limitSlaSec / 60),
    withinTargetAccounts,
    withinLimitAccounts,
    overtimeAccounts,
    measuredAccounts: accountRange.size,
  };
}

function buildWaveDelayMap(accountIds: string[], urgency: "S" | "A" | "B", strategy: ExecutionStrategy) {
  const total = accountIds.length;
  const rule = getWaveRule(strategy, urgency);

  const firstCount = Math.max(1, Math.floor(total * rule.ratios[0]));
  const secondCount = Math.max(0, Math.floor(total * rule.ratios[1]));
  const thirdCount = Math.max(0, total - firstCount - secondCount);

  const plan = [
    { count: firstCount, maxSec: rule.windowsSec[0], minSec: 0 },
    { count: secondCount, maxSec: rule.windowsSec[1], minSec: rule.windowsSec[0] },
    { count: thirdCount, maxSec: rule.windowsSec[2], minSec: rule.windowsSec[1] },
  ];

  const map = new Map<string, number>();
  let cursor = 0;

  for (const wave of plan) {
    for (let i = 0; i < wave.count && cursor < accountIds.length; i += 1) {
      const accountId = accountIds[cursor];
      const delaySec = randomBetween(wave.minSec, Math.max(wave.minSec, wave.maxSec));
      map.set(accountId, delaySec * 1000);
      cursor += 1;
    }
  }

  while (cursor < accountIds.length) {
    map.set(accountIds[cursor], randomBetween(rule.windowsSec[1], rule.windowsSec[2]) * 1000);
    cursor += 1;
  }

  return map;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetryBusy(result: { success: boolean; message: string; responsePayload?: unknown }) {
  if (result.success) {
    return false;
  }

  const payload = result.responsePayload as { code?: string; msg?: string } | undefined;
  const payloadCode = String(payload?.code || "");
  const payloadMsg = String(payload?.msg || "");

  return payloadCode === "100001" || result.message.includes("系统繁忙") || payloadMsg.includes("系统繁忙");
}

function shouldRetryTransient(result: { success: boolean; message: string; responsePayload?: unknown }) {
  if (result.success) {
    return false;
  }

  if (shouldRetryBusy(result)) {
    return true;
  }

  const text = String(result.message || "").toLowerCase();

  return (
    text.includes("timeout") ||
    text.includes("timed out") ||
    text.includes("network") ||
    text.includes("econn") ||
    text.includes("socket") ||
    text.includes("连接") ||
    text.includes("超时")
  );
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function computeStepDelayMs(intervalSec: number) {
  const base = intervalSec > 0 ? intervalSec * 1000 : 0;
  const jitter = randomBetween(400, 1400);
  return base + jitter;
}

function getCooldownRangeMs(urgency: "S" | "A" | "B", strategy: ExecutionStrategy) {
  const range = strategy.actionJob.urgency[urgency].cooldownSecRange;
  return {
    minMs: range[0] * 1000,
    maxMs: range[1] * 1000,
  };
}

function computeAccountCooldownMs(urgency: "S" | "A" | "B", strategy: ExecutionStrategy) {
  const range = getCooldownRangeMs(urgency, strategy);
  return randomBetween(range.minMs, range.maxMs);
}

function computeRetryDelayMs(urgency: "S" | "A" | "B", strategy: ExecutionStrategy) {
  const range = strategy.actionJob.urgency[urgency].retryDelaySecRange;
  return randomBetween(range[0] * 1000, range[1] * 1000);
}

function computeJobStatus(total: number, success: number, failed: number) {
  if (failed === 0 && success === total) {
    return "SUCCESS" as const;
  }

  if (success === 0 && failed > 0) {
    return "FAILED" as const;
  }

  return "PARTIAL_FAILED" as const;
}

function getCommentLikeConcurrency(urgency: "S" | "A" | "B", strategy: ExecutionStrategy) {
  return strategy.actionJob.commentLikeConcurrency[urgency];
}

function shuffleItems<T>(items: T[]) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = current;
  }

  return next;
}

function buildCommentLikeRounds(accountIds: string[], accountStepsMap: Map<string, PrismaActionJobStep[]>) {
  const shuffledMap = new Map<string, PrismaActionJobStep[]>();
  let maxSteps = 0;

  for (const accountId of accountIds) {
    const shuffledSteps = shuffleItems(accountStepsMap.get(accountId) || []);
    shuffledMap.set(accountId, shuffledSteps);
    maxSteps = Math.max(maxSteps, shuffledSteps.length);
  }

  const rounds: Array<Array<{ accountId: string; step: PrismaActionJobStep }>> = [];

  for (let roundIndex = 0; roundIndex < maxSteps; roundIndex += 1) {
    const items: Array<{ accountId: string; step: PrismaActionJobStep }> = [];

    for (const accountId of shuffleItems(accountIds)) {
      const step = shuffledMap.get(accountId)?.[roundIndex];
      if (step) {
        items.push({ accountId, step });
      }
    }

    if (items.length > 0) {
      rounds.push(items);
    }
  }

  return { rounds, shuffledMap };
}

function getCommentLikeStepJitterMs(urgency: "S" | "A" | "B") {
  if (urgency === "S") {
    return 200 + Math.floor(Math.random() * 1200);
  }

  if (urgency === "A") {
    return 500 + Math.floor(Math.random() * 2000);
  }

  return 1000 + Math.floor(Math.random() * 4000);
}

function simulateBrowsePauseMs() {
  return 1000 + Math.floor(Math.random() * 4000);
}

function simulateTypingDelayMs(contentLength: number) {
  return contentLength * (60 + Math.floor(Math.random() * 90));
}

function isDuplicateLikeFailure(message: string) {
  return message.includes("已点赞") || message.includes("点过赞") || message.includes("重复点赞");
}

function getRepostConcurrency(urgency: "S" | "A" | "B", strategy: ExecutionStrategy) {
  return strategy.actionJob.repostConcurrency[urgency];
}

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const size = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(
    Array.from({ length: size }, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;

        if (index >= items.length) {
          return;
        }

        await worker(items[index]);
      }
    }),
  );
}

async function recomputeCommentLikeRunStatus(jobId: string, accountId: string) {
  const existingRun = await prisma.actionJobAccountRun.findFirst({
    where: { jobId, accountId },
    select: { status: true },
  });

  const steps = await prisma.actionJobStep.findMany({
    where: { jobId, accountId },
    select: {
      status: true,
      sequenceNo: true,
      errorMessage: true,
    },
    orderBy: { sequenceNo: "asc" },
  });

  const successCount = steps.filter((step) => step.status === "SUCCESS").length;
  const failedSteps = steps.filter((step) => step.status === "FAILED");
  const failedCount = failedSteps.length;
  const latestFailed = failedSteps[failedSteps.length - 1];
  const status = computeJobStatus(steps.length, successCount, failedCount);

  if (existingRun?.status === "CANCELLED") {
    return;
  }

  await prisma.actionJobAccountRun.updateMany({
    where: { jobId, accountId },
    data: {
      currentStep: steps.length > 0 ? Math.max(...steps.map((step) => step.sequenceNo)) : 0,
      status,
      errorMessage: latestFailed?.errorMessage || null,
    },
  });
}

async function isActionJobCancelled(jobId: string) {
  const job = await prisma.actionJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });

  return job?.status === "CANCELLED";
}

export async function recomputeRepostRunStatus(jobId: string, accountId: string) {
  const existingRun = await prisma.actionJobAccountRun.findFirst({
    where: { jobId, accountId },
    select: { status: true },
  });

  const steps = await prisma.actionJobStep.findMany({
    where: {
      jobId,
      accountId,
    },
    select: {
      id: true,
      status: true,
      sequenceNo: true,
      errorMessage: true,
    },
    orderBy: { sequenceNo: "asc" },
  });

  const successCount = steps.filter((step) => step.status === "SUCCESS").length;
  const failedSteps = steps.filter((step) => step.status === "FAILED");
  const failedCount = failedSteps.length;
  const latestFailed = failedSteps[failedSteps.length - 1];
  const status = computeJobStatus(steps.length, successCount, failedCount);

  if (existingRun?.status === "CANCELLED") {
    return {
      total: steps.length,
      successCount,
      failedCount,
    };
  }

  await prisma.actionJobAccountRun.updateMany({
    where: { jobId, accountId },
    data: {
      status,
      currentStep: steps.length,
      errorMessage: latestFailed?.errorMessage || null,
    },
  });

  return {
    total: steps.length,
    successCount,
    failedCount,
  };
}

export async function recomputeRepostJobSummary(jobId: string, targetUrl: string, times: number, intervalSec: 0 | 3 | 5 | 10, urgency: "S" | "A" | "B") {
  const existingJob = await prisma.actionJob.findUnique({
    where: { id: jobId },
    select: { status: true, summary: true },
  });

  if (existingJob?.status === "CANCELLED") {
    return;
  }

  const finalRuns = await prisma.actionJobAccountRun.findMany({ where: { jobId } });
  const successAccounts = finalRuns.filter((item) => item.status === "SUCCESS").length;
  const failedAccounts = finalRuns.filter((item) => item.status === "FAILED").length;
  const partialAccounts = finalRuns.filter((item) => item.status === "PARTIAL_FAILED").length;
  const finalStatus = failedAccounts === 0 && partialAccounts === 0 ? "SUCCESS" : successAccounts > 0 ? "PARTIAL_FAILED" : "FAILED";
  const strategy = await getExecutionStrategy();
  const sla = await computeJobSlaSummary(jobId, urgency, strategy);

  await prisma.actionJob.update({
    where: { id: jobId },
    data: {
      status: finalStatus,
      summary: {
        ...(existingJob?.summary && typeof existingJob.summary === "object" && !Array.isArray(existingJob.summary) ? (existingJob.summary as Record<string, unknown>) : {}),
        totalAccounts: finalRuns.length,
        successAccounts,
        failedAccounts,
        partialAccounts,
        targetUrl,
        times,
        intervalSec,
        urgency,
        sla,
      },
    },
  });
}

export async function runCommentLikeJob(input: StartCommentLikeJobInput) {
  if (await isActionJobCancelled(input.jobId)) {
    return;
  }

  const [jobRecord, accounts, steps] = await Promise.all([
    prisma.actionJob.findUnique({
      where: { id: input.jobId },
      select: { config: true, summary: true },
    }),
    prisma.weiboAccount.findMany({
      where: {
        id: { in: input.accountIds },
      },
      select: {
        id: true,
        nickname: true,
        loginStatus: true,
        proxyNodeId: true,
        scheduleWindowEnabled: true,
        executionWindowStart: true,
        executionWindowEnd: true,
        baseJitterSec: true,
      },
    }),
    prisma.actionJobStep.findMany({
      where: { jobId: input.jobId },
      orderBy: [{ accountId: "asc" }, { sequenceNo: "asc" }],
    }),
  ]);

  const strategy = await getExecutionStrategy();
  const accountMap = new Map(accounts.map((item) => [item.id, item]));
  const executor = getExecutor();
  const jobConfig = jobRecord?.config && typeof jobRecord.config === "object" && !Array.isArray(jobRecord.config) ? (jobRecord.config as Record<string, unknown>) : {};
  const scheduleDecision = jobConfig.scheduleDecision && typeof jobConfig.scheduleDecision === "object" ? (jobConfig.scheduleDecision as Record<string, unknown>) : null;
  const urgency = (jobConfig.urgency as "S" | "A" | "B" | undefined) || input.urgency || "S";

  const delayMap = buildWaveDelayMap(input.accountIds, urgency, strategy);
  const accountStepsMap = new Map<string, typeof steps>();

  for (const step of steps) {
    const existing = accountStepsMap.get(step.accountId) || [];
    existing.push(step);
    accountStepsMap.set(step.accountId, existing);
  }
  const { rounds, shuffledMap } = buildCommentLikeRounds(input.accountIds, accountStepsMap as Map<string, PrismaActionJobStep[]>);
  const accountState = new Map(input.accountIds.map((accountId) => [accountId, { successCount: 0, failedCount: 0, latestError: "", started: false }]));
  const duplicateLikeTargets = new Map<string, Set<string>>();

  const maxDelay = Math.max(0, ...input.accountIds.map((id) => delayMap.get(id) || 0));
  if (maxDelay > 0) {
    await sleep(maxDelay);
  }

  for (const round of rounds) {
    await runWithConcurrency(round, getCommentLikeConcurrency(urgency, strategy), async ({ accountId, step }) => {
      if (await isActionJobCancelled(input.jobId)) {
        return;
      }

      const account = accountMap.get(accountId);
      const accountSteps = shuffledMap.get(accountId) || [];

      if (!account || accountSteps.length === 0) {
        return;
      }

      const state = accountState.get(accountId);
      if (!state) {
        return;
      }

      const skippedTargets = duplicateLikeTargets.get(accountId);
      if (skippedTargets?.has(step.targetUrl)) {
        await prisma.actionJobStep.update({
          where: { id: step.id },
          data: {
            status: "FAILED",
            errorMessage: "该目标已在本批次判定为已点赞，自动跳过",
            finishedAt: new Date(),
          },
        });
        state.failedCount += 1;
        state.latestError = "该目标已在本批次判定为已点赞，自动跳过";
        await recomputeCommentLikeRunStatus(input.jobId, accountId);
        return;
      }

      if (await isAccountCircuitOpen(accountId)) {
        await prisma.actionJobStep.update({
          where: { id: step.id },
          data: { status: "FAILED", errorMessage: "账号熔断中，跳过执行", finishedAt: new Date() },
        });
        state.failedCount += 1;
        state.latestError = "账号熔断中，跳过执行";
        await recomputeCommentLikeRunStatus(input.jobId, accountId);
        return;
      }

      if (await isProxyCircuitOpen(account.proxyNodeId)) {
        await prisma.actionJobStep.update({
          where: { id: step.id },
          data: { status: "FAILED", errorMessage: "代理熔断中，跳过执行", finishedAt: new Date() },
        });
        state.failedCount += 1;
        state.latestError = "代理熔断中，跳过执行";
        await recomputeCommentLikeRunStatus(input.jobId, accountId);
        return;
      }

      if (!state.started) {
        await prisma.actionJobAccountRun.updateMany({ where: { jobId: input.jobId, accountId }, data: { status: "RUNNING" } });
        state.started = true;
      }

      await prisma.actionJobStep.update({
        where: { id: step.id },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      await sleep(getCommentLikeStepJitterMs(urgency));

      await sleep(simulateBrowsePauseMs());

      const timing = await waitForAccountExecutionWindow(accountId, `action-job:${input.jobId}:comment-like:${step.id}`, {
        scheduleWindowEnabled: account.scheduleWindowEnabled,
        executionWindowStart: account.executionWindowStart,
        executionWindowEnd: account.executionWindowEnd,
        baseJitterSec: account.baseJitterSec,
      });

      if (await isActionJobCancelled(input.jobId)) {
        return;
      }

      let result = await executor.executeInteraction({
        interactionTaskId: step.id,
        accountId,
        accountNickname: account.nickname,
        accountLoginStatus: account.loginStatus,
        actionType: "LIKE",
        targetUrl: step.targetUrl,
      });

      let retryCount = 0;

      for (let attempt = 0; attempt < strategy.actionJob.maxRetry; attempt += 1) {
        if (!shouldRetryTransient(result)) {
          break;
        }

        retryCount = attempt + 1;
        await sleep(computeRetryDelayMs(urgency, strategy));

        if (await isActionJobCancelled(input.jobId)) {
          return;
        }

        result = await executor.executeInteraction({
          interactionTaskId: step.id,
          accountId,
          accountNickname: account.nickname,
          accountLoginStatus: account.loginStatus,
          actionType: "LIKE",
          targetUrl: step.targetUrl,
        });
      }

      if (await isActionJobCancelled(input.jobId)) {
        return;
      }

      const success = result.success && result.status === "SUCCESS";
      if (success) {
        state.successCount += 1;
      } else {
        state.failedCount += 1;
        state.latestError = result.message;
        if (isDuplicateLikeFailure(result.message)) {
          const currentTargets = duplicateLikeTargets.get(accountId) || new Set<string>();
          currentTargets.add(step.targetUrl);
          duplicateLikeTargets.set(accountId, currentTargets);
        }
      }

      await prisma.actionJobStep.update({
        where: { id: step.id },
        data: {
          status: success ? "SUCCESS" : "FAILED",
          resultPayload: result.responsePayload as never,
          errorMessage: success ? null : result.message,
          finishedAt: new Date(),
        },
      });

      const riskMeta = await classifyAndApplyAccountRisk({
        accountId,
        success,
        message: success ? undefined : result.message,
        responsePayload: result.responsePayload,
      });

      await recordExecutionOutcome({
        accountId,
        proxyNodeId: account.proxyNodeId,
        success,
        errorClass: riskMeta.errorClass,
      });

      await writeExecutionLog({
        accountId,
        actionType: success ? "ACTION_JOB_STEP_SUCCESS" : "ACTION_JOB_STEP_FAILED",
        requestPayload: {
          jobId: input.jobId,
          stepId: step.id,
          stepType: "COMMENT_LIKE",
          stepActionType: "LIKE",
          targetUrl: step.targetUrl,
          sequenceNo: step.sequenceNo,
          retryCount,
          timing,
          scheduleDecision,
          riskClass: riskMeta.errorClass,
        },
        responsePayload: attachRiskMetaToPayload(result.responsePayload, riskMeta),
        success,
        errorMessage: success ? undefined : result.message,
      });

      await prisma.actionJobAccountRun.updateMany({
        where: { jobId: input.jobId, accountId },
        data: {
          currentStep: state.successCount + state.failedCount,
          status: state.failedCount > 0 ? "PARTIAL_FAILED" : "RUNNING",
          errorMessage: state.latestError || null,
        },
      });
    });
  }

  for (const accountId of input.accountIds) {
    const state = accountState.get(accountId);
    const accountSteps = shuffledMap.get(accountId) || [];
    if (!state || accountSteps.length === 0) {
      continue;
    }

    const accountStatus = computeJobStatus(accountSteps.length, state.successCount, state.failedCount);
    await prisma.actionJobAccountRun.updateMany({
      where: { jobId: input.jobId, accountId },
      data: {
        status: accountStatus,
        currentStep: state.successCount + state.failedCount,
        errorMessage: state.latestError || null,
      },
    });
  }

  if (await isActionJobCancelled(input.jobId)) {
    return;
  }

  const finalRuns = await prisma.actionJobAccountRun.findMany({ where: { jobId: input.jobId } });
  const successAccounts = finalRuns.filter((item) => item.status === "SUCCESS").length;
  const failedAccounts = finalRuns.filter((item) => item.status === "FAILED").length;
  const partialAccounts = finalRuns.filter((item) => item.status === "PARTIAL_FAILED").length;
  const finalStatus = failedAccounts === 0 && partialAccounts === 0 ? "SUCCESS" : successAccounts > 0 ? "PARTIAL_FAILED" : "FAILED";
  const sla = await computeJobSlaSummary(input.jobId, urgency, strategy);
  const existingSummary = jobRecord?.summary && typeof jobRecord.summary === "object" && !Array.isArray(jobRecord.summary) ? (jobRecord.summary as Record<string, unknown>) : {};

  await prisma.actionJob.update({
    where: { id: input.jobId },
    data: {
      status: finalStatus,
      summary: {
        ...existingSummary,
        totalAccounts: finalRuns.length,
        successAccounts,
        failedAccounts,
        partialAccounts,
        urgency,
        scheduleDecision: scheduleDecision ? JSON.parse(JSON.stringify(scheduleDecision)) : null,
        sla,
      } as never,
    },
  });
}

export async function runRepostRotationJob(input: StartRepostRotationJobInput) {
  if (await isActionJobCancelled(input.jobId)) {
    return;
  }

  const [jobRecord, accounts, steps] = await Promise.all([
    prisma.actionJob.findUnique({
      where: { id: input.jobId },
      select: { config: true, summary: true },
    }),
    prisma.weiboAccount.findMany({
      where: {
        id: { in: input.accountIds },
      },
      select: {
        id: true,
        nickname: true,
        loginStatus: true,
        proxyNodeId: true,
        scheduleWindowEnabled: true,
        executionWindowStart: true,
        executionWindowEnd: true,
        baseJitterSec: true,
      },
    }),
    prisma.actionJobStep.findMany({
      where: { jobId: input.jobId },
      orderBy: [{ accountId: "asc" }, { sequenceNo: "asc" }],
    }),
  ]);

  const strategy = await getExecutionStrategy();
  const accountMap = new Map(accounts.map((item) => [item.id, item]));
  const executor = getExecutor();
  const jobConfig = jobRecord?.config && typeof jobRecord.config === "object" && !Array.isArray(jobRecord.config) ? (jobRecord.config as Record<string, unknown>) : {};
  const scheduleDecision = jobConfig.scheduleDecision && typeof jobConfig.scheduleDecision === "object" ? (jobConfig.scheduleDecision as Record<string, unknown>) : null;
  const urgency = (jobConfig.urgency as "S" | "A" | "B" | undefined) || input.urgency || "A";

  const delayMap = buildWaveDelayMap(input.accountIds, urgency, strategy);
  const accountStepsMap = new Map<string, typeof steps>();

  for (const step of steps) {
    const existing = accountStepsMap.get(step.accountId) || [];
    existing.push(step);
    accountStepsMap.set(step.accountId, existing);
  }

  await runWithConcurrency(input.accountIds, getRepostConcurrency(urgency, strategy), async (accountId) => {
    if (await isActionJobCancelled(input.jobId)) {
      return;
    }

    const account = accountMap.get(accountId);
    const accountSteps = accountStepsMap.get(accountId) || [];

    const waveDelayMs = delayMap.get(accountId) || 0;

    if (waveDelayMs > 0) {
      await sleep(waveDelayMs);
    }

    if (!account || accountSteps.length === 0) {
      return;
    }

    await prisma.actionJobAccountRun.updateMany({
      where: { jobId: input.jobId, accountId },
      data: { status: "RUNNING" },
    });

    for (const step of accountSteps) {
      if (await isActionJobCancelled(input.jobId)) {
        return;
      }

      await prisma.actionJobStep.update({
        where: { id: step.id },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      const timing = await waitForAccountExecutionWindow(accountId, `action-job:${input.jobId}:repost:${step.id}`, {
        scheduleWindowEnabled: account.scheduleWindowEnabled,
        executionWindowStart: account.executionWindowStart,
        executionWindowEnd: account.executionWindowEnd,
        baseJitterSec: account.baseJitterSec,
      });

      if (await isActionJobCancelled(input.jobId)) {
        return;
      }

      const payload = (step.payload || {}) as { repostContent?: string };
      if (payload.repostContent) {
        await sleep(simulateTypingDelayMs(payload.repostContent.length));
      }
      let result = await executor.executeInteraction({
        interactionTaskId: step.id,
        accountId,
        accountNickname: account.nickname,
        accountLoginStatus: account.loginStatus,
        actionType: "POST",
        targetUrl: step.targetUrl,
        repostContent: payload.repostContent || null,
      });

      if (await isActionJobCancelled(input.jobId)) {
        return;
      }

      let retryCount = 0;

      for (let attempt = 0; attempt < strategy.actionJob.maxRetry; attempt += 1) {
        if (!shouldRetryTransient(result)) {
          break;
        }

        retryCount = attempt + 1;
        await sleep(computeRetryDelayMs(urgency, strategy));

        if (await isActionJobCancelled(input.jobId)) {
          return;
        }

        result = await executor.executeInteraction({
          interactionTaskId: step.id,
          accountId,
          accountNickname: account.nickname,
          accountLoginStatus: account.loginStatus,
          actionType: "POST",
          targetUrl: step.targetUrl,
          repostContent: payload.repostContent || null,
        });

        if (await isActionJobCancelled(input.jobId)) {
          return;
        }
      }

      const success = result.success && result.status === "SUCCESS";

      await prisma.actionJobStep.update({
        where: { id: step.id },
        data: {
          status: success ? "SUCCESS" : "FAILED",
          resultPayload: result.responsePayload as never,
          errorMessage: success ? null : result.message,
          finishedAt: new Date(),
        },
      });

      const riskMeta = await classifyAndApplyAccountRisk({
        accountId,
        success,
        message: success ? undefined : result.message,
        responsePayload: result.responsePayload,
      });

      await writeExecutionLog({
        accountId,
        actionType: success ? "ACTION_JOB_STEP_SUCCESS" : "ACTION_JOB_STEP_FAILED",
        requestPayload: {
          jobId: input.jobId,
          stepId: step.id,
          stepType: "REPOST",
          stepActionType: "POST",
          targetUrl: step.targetUrl,
          sequenceNo: step.sequenceNo,
          repostContent: payload.repostContent || "",
          retryCount,
          timing,
          scheduleDecision,
          riskClass: riskMeta.errorClass,
        },
        responsePayload: attachRiskMetaToPayload(result.responsePayload, riskMeta),
        success,
        errorMessage: success ? undefined : result.message,
      });

      await recomputeRepostRunStatus(input.jobId, accountId);

      if (step.sequenceNo < input.times) {
        const intervalDelayMs = computeStepDelayMs(input.intervalSec);
        const cooldownDelayMs = computeAccountCooldownMs(urgency, strategy);
        await sleep(Math.max(intervalDelayMs, cooldownDelayMs));

        if (await isActionJobCancelled(input.jobId)) {
          return;
        }
      }
    }

    await recomputeRepostRunStatus(input.jobId, accountId);
  });

  if (await isActionJobCancelled(input.jobId)) {
    return;
  }

  await recomputeRepostJobSummary(input.jobId, input.targetUrl, input.times, input.intervalSec, urgency);
}
