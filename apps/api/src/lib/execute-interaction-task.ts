import { classifyAndApplyAccountRisk, attachRiskMetaToPayload } from "@/src/lib/account-risk";
import { waitForAccountExecutionWindow } from "@/src/lib/account-timing";
import { isAccountCircuitOpen, isProxyCircuitOpen, recordExecutionOutcome } from "@/src/lib/circuit-breaker";
import { getExecutor } from "@/src/lib/executor-index";
import { writeExecutionLog } from "@/src/lib/execution-log";
import { prisma } from "@/src/lib/prisma";
import { reserveRateLimitedExecution, resolveInteractionTaskType } from "@/src/lib/rate-limit";

const interactionInclude = {
  account: true,
  target: true,
  content: true,
} as const;

async function getCancelledInteractionTask(id: string) {
  const task = await prisma.interactionTask.findUnique({ where: { id }, include: interactionInclude });
  if (!task || task.status !== "CANCELLED") return null;
  return task;
}

function toCancelledResult(task: Awaited<ReturnType<typeof getCancelledInteractionTask>>) {
  return { ok: true as const, success: false, data: task, message: task?.resultMessage || "互动任务已停止" };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeInteractionTaskById(id: string, ownerUserId: string, executorAccountId?: string) {
  const task = await prisma.interactionTask.findUnique({ where: { id }, include: interactionInclude });
  if (!task) return { ok: false as const, status: 404, message: "互动任务不存在" };
  if (task.account.ownerUserId !== ownerUserId) return { ok: false as const, status: 403, message: "互动任务不属于当前用户" };
  if (task.status === "CANCELLED") return toCancelledResult(task);

  await prisma.interactionTask.update({ where: { id }, data: { status: "RUNNING", resultMessage: "执行中，支持手动停止" } });

  let executionAccount = task.account;
  if (executorAccountId) {
    const selectedAccount = await prisma.weiboAccount.findUnique({ where: { id: executorAccountId } });
    if (!selectedAccount || selectedAccount.ownerUserId !== ownerUserId) {
      return { ok: false as const, status: 403, message: "执行账号不存在或无权限" };
    }
    executionAccount = selectedAccount;
  }

  if (await isAccountCircuitOpen(executionAccount.id)) {
    const updated = await prisma.interactionTask.update({ where: { id }, data: { status: "FAILED", resultMessage: "账号熔断中，互动任务已自动暂停" }, include: interactionInclude });
    return { ok: true as const, success: false, data: updated, message: updated.resultMessage || "互动任务已暂停" };
  }

  if (await isProxyCircuitOpen(executionAccount.proxyNodeId)) {
    const updated = await prisma.interactionTask.update({ where: { id }, data: { status: "FAILED", resultMessage: "代理熔断中，互动任务已自动暂停" }, include: interactionInclude });
    return { ok: true as const, success: false, data: updated, message: updated.resultMessage || "互动任务已暂停" };
  }

  const interactionActionType = task.actionType === "REPOST" || task.actionType === "POST" ? "POST" : task.actionType;
  const interactionContent = task.content?.content || null;

  const scheduleDecision = await reserveRateLimitedExecution({ ownerUserId, taskType: resolveInteractionTaskType(interactionActionType), baseTier: "A" });
  if (scheduleDecision.delayMs > 0) {
    await prisma.interactionTask.update({ where: { id }, data: { resultMessage: `调度限速生效，已延后 ${Math.ceil(scheduleDecision.delayMs / 1000)} 秒执行` } });
    await writeExecutionLog({
      accountId: executionAccount.id,
      actionType: "INTERACTION_DELAYED",
      requestPayload: {
        interactionTaskId: task.id,
        actionType: interactionActionType,
        delayMs: scheduleDecision.delayMs,
        delaySeconds: Math.ceil(scheduleDecision.delayMs / 1000),
        scheduleDecision,
        queueState: "DELAYED",
      },
      success: true,
      errorMessage: `调度限速生效，已延后 ${Math.ceil(scheduleDecision.delayMs / 1000)} 秒执行`,
    });
    await sleep(scheduleDecision.delayMs);
  }

  const timing = await waitForAccountExecutionWindow(executionAccount.id, `interaction:${task.id}`, {
    scheduleWindowEnabled: executionAccount.scheduleWindowEnabled,
    executionWindowStart: executionAccount.executionWindowStart,
    executionWindowEnd: executionAccount.executionWindowEnd,
    baseJitterSec: executionAccount.baseJitterSec,
  });

  const cancelledAfterWait = await getCancelledInteractionTask(id);
  if (cancelledAfterWait) return toCancelledResult(cancelledAfterWait);

  const executor = getExecutor();
  const executionResult = await executor.executeInteraction({
    interactionTaskId: task.id,
    accountId: executionAccount.id,
    accountNickname: executionAccount.nickname,
    accountLoginStatus: executionAccount.loginStatus,
    actionType: interactionActionType,
    targetUrl: task.target.targetUrl,
    repostContent: task.actionType === "REPOST" || task.actionType === "POST" ? interactionContent : undefined,
    commentText: task.actionType === "COMMENT" ? interactionContent : undefined,
  });

  const updated = await prisma.interactionTask.update({
    where: { id },
    data: { status: executionResult.status, resultMessage: executionResult.message },
    include: interactionInclude,
  });

  const actionType = executionResult.stage === "PRECHECK_BLOCKED" ? "INTERACTION_EXECUTE_BLOCKED" : "INTERACTION_EXECUTE_PRECHECKED";
  const riskMeta = await classifyAndApplyAccountRisk({ accountId: executionAccount.id, success: executionResult.success, message: executionResult.message, responsePayload: executionResult.responsePayload });
  await recordExecutionOutcome({ accountId: executionAccount.id, proxyNodeId: executionAccount.proxyNodeId, success: executionResult.success, errorClass: riskMeta.errorClass });

  await writeExecutionLog({
    accountId: executionAccount.id,
    actionType,
    requestPayload: {
      interactionTaskId: task.id,
      actionType: updated.actionType,
      targetUrl: updated.target.targetUrl,
      contentId: updated.contentId,
      sourceTaskAccountId: updated.accountId,
      executionAccountId: executionAccount.id,
      stage: executionResult.stage,
      timing,
      scheduleDecision,
      riskClass: riskMeta.errorClass,
    },
    responsePayload: attachRiskMetaToPayload(executionResult.responsePayload, riskMeta),
    success: executionResult.success,
    errorMessage: executionResult.success ? undefined : executionResult.message,
  });

  return { ok: true as const, success: executionResult.success, data: updated, message: executionResult.message };
}
