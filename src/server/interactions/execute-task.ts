import { prisma } from "@/lib/prisma";
import { getExecutor } from "@/server/executors";
import { writeExecutionLog } from "@/server/logs";
import { attachRiskMetaToPayload, classifyAndApplyAccountRisk } from "@/server/risk/account-risk";
import { isAccountCircuitOpen, isProxyCircuitOpen, recordExecutionOutcome } from "@/server/risk/circuit-breaker";
import { waitForAccountExecutionWindow } from "@/server/task-scheduler/account-timing";

const interactionInclude = {
  account: true,
  target: true,
  content: true,
} as const;

async function getCancelledInteractionTask(id: string) {
  const task = await prisma.interactionTask.findUnique({
    where: { id },
    include: interactionInclude,
  });

  if (!task || task.status !== "CANCELLED") {
    return null;
  }

  return task;
}

function toCancelledResult(task: Awaited<ReturnType<typeof getCancelledInteractionTask>>) {
  return {
    ok: true as const,
    success: false,
    data: task,
    message: task?.resultMessage || "互动任务已停止",
  };
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeInteractionTaskById(id: string, ownerUserId: string, executorAccountId?: string) {
  const task = await prisma.interactionTask.findUnique({
    where: { id },
    include: interactionInclude,
  });

  if (!task) {
    return { ok: false as const, status: 404, message: "互动任务不存在" };
  }

  if (task.account.ownerUserId !== ownerUserId) {
    return { ok: false as const, status: 403, message: "互动任务不属于当前用户" };
  }

  if (task.status === "CANCELLED") {
    return toCancelledResult(task);
  }

  await prisma.interactionTask.update({
    where: { id },
    data: {
      status: "RUNNING",
      resultMessage: "执行中，支持手动停止",
    },
  });

  let executionAccount = task.account;

  if (executorAccountId) {
    const selectedAccount = await prisma.weiboAccount.findUnique({ where: { id: executorAccountId } });

    if (!selectedAccount || selectedAccount.ownerUserId !== ownerUserId) {
      return { ok: false as const, status: 403, message: "执行账号不存在或无权限" };
    }

    executionAccount = selectedAccount;
  }

  const executor = getExecutor();

  if (await isAccountCircuitOpen(executionAccount.id)) {
    const updated = await prisma.interactionTask.update({
      where: { id },
      data: { status: "FAILED", resultMessage: "账号熔断中，互动任务已自动暂停" },
      include: interactionInclude,
    });

    return { ok: true as const, success: false, data: updated, message: updated.resultMessage || "互动任务已暂停" };
  }

  if (await isProxyCircuitOpen(executionAccount.proxyNodeId)) {
    const updated = await prisma.interactionTask.update({
      where: { id },
      data: { status: "FAILED", resultMessage: "代理熔断中，互动任务已自动暂停" },
      include: interactionInclude,
    });

    return { ok: true as const, success: false, data: updated, message: updated.resultMessage || "互动任务已暂停" };
  }

  const timing = await waitForAccountExecutionWindow(executionAccount.id, `interaction:${task.id}`, {
    scheduleWindowEnabled: executionAccount.scheduleWindowEnabled,
    executionWindowStart: executionAccount.executionWindowStart,
    executionWindowEnd: executionAccount.executionWindowEnd,
    baseJitterSec: executionAccount.baseJitterSec,
  });

  const cancelledAfterWait = await getCancelledInteractionTask(id);

  if (cancelledAfterWait) {
    return toCancelledResult(cancelledAfterWait);
  }

  let executionResult = await executor.executeInteraction({
    interactionTaskId: task.id,
    accountId: executionAccount.id,
    accountNickname: executionAccount.nickname,
    accountLoginStatus: executionAccount.loginStatus,
    actionType: task.actionType,
    targetUrl: task.target.targetUrl,
    commentText: task.content?.content || null,
  });

  let retryCount = 0;

  if (shouldRetryBusy(executionResult)) {
    retryCount = 1;
    await sleep(1200);

    const cancelledBeforeRetry = await getCancelledInteractionTask(id);

    if (cancelledBeforeRetry) {
      return toCancelledResult(cancelledBeforeRetry);
    }

    executionResult = await executor.executeInteraction({
      interactionTaskId: task.id,
      accountId: executionAccount.id,
      accountNickname: executionAccount.nickname,
      accountLoginStatus: executionAccount.loginStatus,
      actionType: task.actionType,
      targetUrl: task.target.targetUrl,
      commentText: task.content?.content || null,
    });
  }

  const cancelledBeforeFinalize = await getCancelledInteractionTask(id);

  if (cancelledBeforeFinalize) {
    return toCancelledResult(cancelledBeforeFinalize);
  }

  const updated = await prisma.interactionTask.update({
    where: { id },
    data: {
      status: executionResult.status,
      resultMessage: executionResult.message,
    },
    include: interactionInclude,
  });

  const actionType = executionResult.stage === "PRECHECK_BLOCKED" ? "INTERACTION_EXECUTE_BLOCKED" : "INTERACTION_EXECUTE_PRECHECKED";
  await recordExecutionOutcome({ accountId: executionAccount.id, proxyNodeId: executionAccount.proxyNodeId, success: executionResult.success });
  const riskMeta = await classifyAndApplyAccountRisk({
    accountId: executionAccount.id,
    success: executionResult.success,
    message: executionResult.message,
    responsePayload: executionResult.responsePayload,
  });

  await writeExecutionLog({
    accountId: executionAccount.id,
    actionType,
    requestPayload: {
      actionType: updated.actionType,
      targetUrl: updated.target.targetUrl,
      contentId: updated.contentId,
      sourceTaskAccountId: updated.accountId,
      executionAccountId: executionAccount.id,
      retryCount,
      stage: executionResult.stage,
      timing,
      riskClass: riskMeta.errorClass,
    },
    responsePayload: attachRiskMetaToPayload(executionResult.responsePayload, riskMeta),
    success: executionResult.success,
    errorMessage: executionResult.success ? undefined : executionResult.message,
  });

  return { ok: true as const, success: executionResult.success, data: updated, message: executionResult.message };
}
