import { prisma } from "@/lib/prisma";
import { getExecutor } from "@/server/executors";
import { writeExecutionLog } from "@/server/logs";

type StartCommentLikeJobInput = {
  jobId: string;
  accountIds: string[];
  poolItems: Array<{ id: string; sourceUrl: string }>;
};

type StartRepostRotationJobInput = {
  jobId: string;
  accountIds: string[];
  targetUrl: string;
  times: number;
  intervalSec: 0 | 3 | 5 | 10;
};

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

export async function recomputeRepostRunStatus(jobId: string, accountId: string) {
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
  const [accounts, steps] = await Promise.all([
    prisma.weiboAccount.findMany({
      where: {
        id: { in: input.accountIds },
      },
      select: {
        id: true,
        nickname: true,
        loginStatus: true,
      },
    }),
    prisma.actionJobStep.findMany({
      where: { jobId: input.jobId },
      orderBy: [{ accountId: "asc" }, { sequenceNo: "asc" }],
    }),
  ]);

  const accountMap = new Map(accounts.map((item) => [item.id, item]));
  const executor = getExecutor();

  for (const accountId of input.accountIds) {
    const account = accountMap.get(accountId);
    const accountSteps = steps.filter((item) => item.accountId === accountId);

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
      await prisma.actionJobStep.update({
        where: { id: step.id },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      const result = await executor.executeInteraction({
        interactionTaskId: step.id,
        accountId,
        accountNickname: account.nickname,
        accountLoginStatus: account.loginStatus,
        actionType: "LIKE",
        targetUrl: step.targetUrl,
      });

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

      await writeExecutionLog({
        accountId,
        actionType: success ? "ACTION_JOB_STEP_SUCCESS" : "ACTION_JOB_STEP_FAILED",
        requestPayload: {
          jobId: input.jobId,
          stepId: step.id,
          stepType: "COMMENT_LIKE",
          targetUrl: step.targetUrl,
          sequenceNo: step.sequenceNo,
        },
        responsePayload: result.responsePayload,
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
  const [accounts, steps] = await Promise.all([
    prisma.weiboAccount.findMany({
      where: {
        id: { in: input.accountIds },
      },
      select: {
        id: true,
        nickname: true,
        loginStatus: true,
      },
    }),
    prisma.actionJobStep.findMany({
      where: { jobId: input.jobId },
      orderBy: [{ accountId: "asc" }, { sequenceNo: "asc" }],
    }),
  ]);

  const accountMap = new Map(accounts.map((item) => [item.id, item]));
  const executor = getExecutor();

  for (const accountId of input.accountIds) {
    const account = accountMap.get(accountId);
    const accountSteps = steps.filter((item) => item.accountId === accountId);

    if (!account || accountSteps.length === 0) {
      continue;
    }

    await prisma.actionJobAccountRun.updateMany({
      where: { jobId: input.jobId, accountId },
      data: { status: "RUNNING" },
    });

    for (const step of accountSteps) {
      await prisma.actionJobStep.update({
        where: { id: step.id },
        data: { status: "RUNNING", startedAt: new Date() },
      });

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

      let retryCount = 0;

      if (shouldRetryBusy(result)) {
        retryCount = 1;
        await sleep(2000);
        result = await executor.executeInteraction({
          interactionTaskId: step.id,
          accountId,
          accountNickname: account.nickname,
          accountLoginStatus: account.loginStatus,
          actionType: "POST",
          targetUrl: step.targetUrl,
          repostContent: payload.repostContent || null,
        });
      }

      if (!result.success && shouldRetryBusy(result)) {
        retryCount = 2;
        await sleep(5000);
        result = await executor.executeInteraction({
          interactionTaskId: step.id,
          accountId,
          accountNickname: account.nickname,
          accountLoginStatus: account.loginStatus,
          actionType: "POST",
          targetUrl: step.targetUrl,
          repostContent: payload.repostContent || null,
        });
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

      await writeExecutionLog({
        accountId,
        actionType: success ? "ACTION_JOB_STEP_SUCCESS" : "ACTION_JOB_STEP_FAILED",
        requestPayload: {
          jobId: input.jobId,
          stepId: step.id,
          stepType: "REPOST",
          targetUrl: step.targetUrl,
          sequenceNo: step.sequenceNo,
          repostContent: payload.repostContent || "",
          retryCount,
        },
        responsePayload: result.responsePayload,
        success,
        errorMessage: success ? undefined : result.message,
      });

      await recomputeRepostRunStatus(input.jobId, accountId);

      if (step.sequenceNo < input.times) {
        await sleep(computeStepDelayMs(input.intervalSec));
      }
    }

    await recomputeRepostRunStatus(input.jobId, accountId);
  }

  await recomputeRepostJobSummary(input.jobId, input.targetUrl, input.times, input.intervalSec);
}
