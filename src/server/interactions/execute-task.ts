import { prisma } from "@/lib/prisma";
import { getExecutor } from "@/server/executors";
import { writeExecutionLog } from "@/server/logs";
import { waitForAccountExecutionWindow } from "@/server/task-scheduler/account-timing";

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
    include: {
      account: true,
      target: true,
      content: true,
    },
  });

  if (!task) {
    return { ok: false as const, status: 404, message: "互动任务不存在" };
  }

  if (task.account.ownerUserId !== ownerUserId) {
    return { ok: false as const, status: 403, message: "互动任务不属于当前用户" };
  }

  let executionAccount = task.account;

  if (executorAccountId) {
    const selectedAccount = await prisma.weiboAccount.findUnique({ where: { id: executorAccountId } });

    if (!selectedAccount || selectedAccount.ownerUserId !== ownerUserId) {
      return { ok: false as const, status: 403, message: "执行账号不存在或无权限" };
    }

    executionAccount = selectedAccount;
  }

  const executor = getExecutor();
  const timing = await waitForAccountExecutionWindow(executionAccount.id, `interaction:${task.id}`, {
    scheduleWindowEnabled: executionAccount.scheduleWindowEnabled,
    executionWindowStart: executionAccount.executionWindowStart,
    executionWindowEnd: executionAccount.executionWindowEnd,
    baseJitterSec: executionAccount.baseJitterSec,
  });
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

  const updated = await prisma.interactionTask.update({
    where: { id },
    data: {
      status: executionResult.status,
      resultMessage: executionResult.message,
    },
    include: {
      account: true,
      target: true,
      content: true,
    },
  });

  const actionType = executionResult.stage === "PRECHECK_BLOCKED" ? "INTERACTION_EXECUTE_BLOCKED" : "INTERACTION_EXECUTE_PRECHECKED";

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
    },
    responsePayload: executionResult.responsePayload,
    success: executionResult.success,
    errorMessage: executionResult.success ? undefined : executionResult.message,
  });

  return { ok: true as const, success: executionResult.success, data: updated, message: executionResult.message };
}
