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

function computeJobStatus(total: number, success: number, failed: number) {
  if (failed === 0 && success === total) {
    return "SUCCESS" as const;
  }

  if (success === 0 && failed > 0) {
    return "FAILED" as const;
  }

  return "PARTIAL_FAILED" as const;
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

      const payload = (step.payload || {}) as { repostContent?: string };
      const result = await executor.executeInteraction({
        interactionTaskId: step.id,
        accountId,
        accountNickname: account.nickname,
        accountLoginStatus: account.loginStatus,
        actionType: "POST",
        targetUrl: step.targetUrl,
        repostContent: payload.repostContent || null,
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
          stepType: "REPOST",
          targetUrl: step.targetUrl,
          sequenceNo: step.sequenceNo,
          repostContent: payload.repostContent || "",
        },
        responsePayload: result.responsePayload,
        success,
        errorMessage: success ? undefined : result.message,
      });

      await prisma.actionJobAccountRun.updateMany({
        where: { jobId: input.jobId, accountId },
        data: {
          currentStep: step.sequenceNo,
          status: failedCount > 0 ? "FAILED" : "RUNNING",
          errorMessage: latestError || null,
        },
      });

      if (!success) {
        const remainingSteps = accountSteps.filter((item) => item.sequenceNo > step.sequenceNo);

        if (remainingSteps.length > 0) {
          await prisma.actionJobStep.updateMany({
            where: {
              id: {
                in: remainingSteps.map((item) => item.id),
              },
            },
            data: {
              status: "CANCELLED",
              errorMessage: "同账号前序轮转失败，后续步骤自动停止",
              finishedAt: new Date(),
            },
          });
        }

        break;
      }

      if (input.intervalSec > 0 && step.sequenceNo < input.times) {
        await sleep(input.intervalSec * 1000);
      }
    }

    const accountStatus = failedCount > 0 ? "FAILED" : successCount === input.times ? "SUCCESS" : "PARTIAL_FAILED";

    await prisma.actionJobAccountRun.updateMany({
      where: { jobId: input.jobId, accountId },
      data: {
        status: accountStatus,
        currentStep: successCount + failedCount,
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
        targetUrl: input.targetUrl,
        times: input.times,
        intervalSec: input.intervalSec,
      },
    },
  });
}
