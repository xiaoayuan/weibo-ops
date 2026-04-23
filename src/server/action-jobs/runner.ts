import { prisma } from "@/lib/prisma";
import { getExecutor } from "@/server/executors";
import { writeExecutionLog } from "@/server/logs";
import { attachRiskMetaToPayload, classifyAndApplyAccountRisk } from "@/server/risk/account-risk";
import { waitForAccountExecutionWindow } from "@/server/task-scheduler/account-timing";

type StartCommentLikeJobInput = {
  jobId: string;
  accountIds: string[];
  poolItems: Array<{ id: string; sourceUrl: string }>;
  urgency?: "S" | "A" | "B";
};

type StartRepostRotationJobInput = {
  jobId: string;
  accountIds: string[];
  targetUrl: string;
  times: number;
  intervalSec: 0 | 3 | 5 | 10;
  urgency?: "S" | "A" | "B";
};

type WaveRule = {
  ratios: [number, number, number];
  windowsSec: [number, number, number];
};

function getWaveRule(urgency: "S" | "A" | "B"): WaveRule {
  if (urgency === "S") {
    return {
      ratios: [0.3, 0.4, 0.3],
      windowsSec: [180, 600, 1800],
    };
  }

  if (urgency === "A") {
    return {
      ratios: [0.2, 0.3, 0.5],
      windowsSec: [600, 1800, 7200],
    };
  }

  return {
    ratios: [0.1, 0.2, 0.7],
    windowsSec: [1800, 7200, 43200],
  };
}

function buildWaveDelayMap(accountIds: string[], urgency: "S" | "A" | "B") {
  const total = accountIds.length;
  const rule = getWaveRule(urgency);

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

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function computeStepDelayMs(intervalSec: number) {
  const base = intervalSec > 0 ? intervalSec * 1000 : 0;
  const jitter = randomBetween(400, 1400);
  return base + jitter;
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

export async function recomputeRepostJobSummary(jobId: string, targetUrl: string, times: number, intervalSec: 0 | 3 | 5 | 10) {
  const existingJob = await prisma.actionJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });

  if (existingJob?.status === "CANCELLED") {
    return;
  }

  const finalRuns = await prisma.actionJobAccountRun.findMany({ where: { jobId } });
  const successAccounts = finalRuns.filter((item) => item.status === "SUCCESS").length;
  const failedAccounts = finalRuns.filter((item) => item.status === "FAILED").length;
  const partialAccounts = finalRuns.filter((item) => item.status === "PARTIAL_FAILED").length;
  const finalStatus = failedAccounts === 0 && partialAccounts === 0 ? "SUCCESS" : successAccounts > 0 ? "PARTIAL_FAILED" : "FAILED";

  await prisma.actionJob.update({
    where: { id: jobId },
    data: {
      status: finalStatus,
      summary: {
        totalAccounts: finalRuns.length,
        successAccounts,
        failedAccounts,
        partialAccounts,
        targetUrl,
        times,
        intervalSec,
      },
    },
  });
}

export async function runCommentLikeJob(input: StartCommentLikeJobInput) {
  if (await isActionJobCancelled(input.jobId)) {
    return;
  }

  const [accounts, steps] = await Promise.all([
    prisma.weiboAccount.findMany({
      where: {
        id: { in: input.accountIds },
      },
      select: {
        id: true,
        nickname: true,
        loginStatus: true,
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

  const accountMap = new Map(accounts.map((item) => [item.id, item]));
  const executor = getExecutor();
  const delayMap = buildWaveDelayMap(input.accountIds, input.urgency || "S");

  for (const accountId of input.accountIds) {
    if (await isActionJobCancelled(input.jobId)) {
      return;
    }

    const account = accountMap.get(accountId);
    const accountSteps = steps.filter((item) => item.accountId === accountId);

    const waveDelayMs = delayMap.get(accountId) || 0;

    if (waveDelayMs > 0) {
      await sleep(waveDelayMs);
    }

    if (!account || accountSteps.length === 0) {
      continue;
    }

    let successCount = 0;
    let failedCount = 0;
    let latestError = "";

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

      const timing = await waitForAccountExecutionWindow(accountId, `action-job:${input.jobId}:comment-like:${step.id}`, {
        scheduleWindowEnabled: account.scheduleWindowEnabled,
        executionWindowStart: account.executionWindowStart,
        executionWindowEnd: account.executionWindowEnd,
        baseJitterSec: account.baseJitterSec,
      });

      if (await isActionJobCancelled(input.jobId)) {
        return;
      }

      const result = await executor.executeInteraction({
        interactionTaskId: step.id,
        accountId,
        accountNickname: account.nickname,
        accountLoginStatus: account.loginStatus,
        actionType: "LIKE",
        targetUrl: step.targetUrl,
      });

      if (await isActionJobCancelled(input.jobId)) {
        return;
      }

      const success = result.success && result.status === "SUCCESS";

      if (success) {
        successCount += 1;
      } else {
        failedCount += 1;
        latestError = result.message;
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
          timing,
          riskClass: riskMeta.errorClass,
        },
        responsePayload: attachRiskMetaToPayload(result.responsePayload, riskMeta),
        success,
        errorMessage: success ? undefined : result.message,
      });

      await prisma.actionJobAccountRun.updateMany({
        where: { jobId: input.jobId, accountId },
        data: {
          currentStep: step.sequenceNo,
          status: failedCount > 0 ? "PARTIAL_FAILED" : "RUNNING",
          errorMessage: latestError || null,
        },
      });
    }

    const accountStatus = computeJobStatus(accountSteps.length, successCount, failedCount);

    await prisma.actionJobAccountRun.updateMany({
      where: { jobId: input.jobId, accountId },
      data: {
        status: accountStatus,
        currentStep: accountSteps.length,
        errorMessage: latestError || null,
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

  await prisma.actionJob.update({
    where: { id: input.jobId },
    data: {
      status: finalStatus,
      summary: {
        totalAccounts: finalRuns.length,
        successAccounts,
        failedAccounts,
        partialAccounts,
      },
    },
  });
}

export async function runRepostRotationJob(input: StartRepostRotationJobInput) {
  if (await isActionJobCancelled(input.jobId)) {
    return;
  }

  const [accounts, steps] = await Promise.all([
    prisma.weiboAccount.findMany({
      where: {
        id: { in: input.accountIds },
      },
      select: {
        id: true,
        nickname: true,
        loginStatus: true,
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

  const accountMap = new Map(accounts.map((item) => [item.id, item]));
  const executor = getExecutor();
  const delayMap = buildWaveDelayMap(input.accountIds, input.urgency || "A");

  for (const accountId of input.accountIds) {
    if (await isActionJobCancelled(input.jobId)) {
      return;
    }

    const account = accountMap.get(accountId);
    const accountSteps = steps.filter((item) => item.accountId === accountId);

    const waveDelayMs = delayMap.get(accountId) || 0;

    if (waveDelayMs > 0) {
      await sleep(waveDelayMs);
    }

    if (!account || accountSteps.length === 0) {
      continue;
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

      if (shouldRetryBusy(result)) {
        retryCount = 1;
        await sleep(2000);

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

      if (!result.success && shouldRetryBusy(result)) {
        retryCount = 2;
        await sleep(5000);

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
          riskClass: riskMeta.errorClass,
        },
        responsePayload: attachRiskMetaToPayload(result.responsePayload, riskMeta),
        success,
        errorMessage: success ? undefined : result.message,
      });

      await recomputeRepostRunStatus(input.jobId, accountId);

      if (step.sequenceNo < input.times) {
        await sleep(computeStepDelayMs(input.intervalSec));

        if (await isActionJobCancelled(input.jobId)) {
          return;
        }
      }
    }

    await recomputeRepostRunStatus(input.jobId, accountId);
  }

  if (await isActionJobCancelled(input.jobId)) {
    return;
  }

  await recomputeRepostJobSummary(input.jobId, input.targetUrl, input.times, input.intervalSec);
}
