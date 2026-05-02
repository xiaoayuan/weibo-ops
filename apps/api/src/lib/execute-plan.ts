import { classifyAndApplyAccountRisk, attachRiskMetaToPayload } from "@/src/lib/account-risk";
import { waitForAccountExecutionWindow } from "@/src/lib/account-timing";
import { getBusinessDateText } from "@/src/lib/business-date";
import { isAccountCircuitOpen, isProxyCircuitOpen, recordExecutionOutcome } from "@/src/lib/circuit-breaker";
import { decryptText, getDecryptErrorMessage } from "@/src/lib/encrypt";
import { getExecutor } from "@/src/lib/executor-index";
import { writeExecutionLog } from "@/src/lib/execution-log";
import { checkStatusIsZeroComments, fetchLatestPosts, pickRandomTemplate, sendFirstComment } from "@/src/lib/first-comment-plan";
import { prisma } from "@/src/lib/prisma";
import { getProxyConfigForAccount } from "@/src/lib/proxy-config";
import { reserveRateLimitedExecution, resolvePlanTaskType } from "@/src/lib/rate-limit";
import { getRiskRules } from "@/src/lib/risk-rules";

const planInclude = {
  account: true,
  content: true,
  task: {
    include: {
      superTopic: true,
    },
  },
} as const;

async function getCancelledPlan(id: string) {
  const plan = await prisma.dailyPlan.findUnique({ where: { id }, include: planInclude });
  if (!plan || plan.status !== "CANCELLED") return null;
  return plan;
}

function toCancelledResult(plan: Awaited<ReturnType<typeof getCancelledPlan>>) {
  return { ok: true as const, success: false, message: plan?.resultMessage || "计划已停止", data: plan };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executePlanById(id: string, ownerUserId?: string) {
  const plan = await prisma.dailyPlan.findUnique({ where: { id }, include: planInclude });
  if (!plan) return { ok: false as const, status: 404, message: "计划不存在" };
  if (ownerUserId && plan.account.ownerUserId !== ownerUserId) return { ok: false as const, status: 404, message: "计划不存在" };
  if (plan.status === "CANCELLED") return toCancelledResult(plan);

  if (await isAccountCircuitOpen(plan.accountId)) {
    const updated = await prisma.dailyPlan.update({ where: { id }, data: { status: "FAILED", resultMessage: "账号熔断中，计划已自动暂停" }, include: planInclude });
    return { ok: true as const, success: false, message: updated.resultMessage || "计划已暂停", data: updated };
  }

  if (await isProxyCircuitOpen(plan.account.proxyNodeId)) {
    const updated = await prisma.dailyPlan.update({ where: { id }, data: { status: "FAILED", resultMessage: "代理熔断中，计划已自动暂停" }, include: planInclude });
    return { ok: true as const, success: false, message: updated.resultMessage || "计划已暂停", data: updated };
  }

  await prisma.dailyPlan.update({ where: { id }, data: { status: "RUNNING", resultMessage: "执行中，支持手动停止" } });

  const scheduleDecision = await reserveRateLimitedExecution({
    ownerUserId: plan.account.ownerUserId || `account:${plan.accountId}`,
    taskType: resolvePlanTaskType(plan.planType),
    baseTier: "B",
  });

  if (scheduleDecision.delayMs > 0) {
    await prisma.dailyPlan.update({ where: { id }, data: { resultMessage: `调度限速生效，已延后 ${Math.ceil(scheduleDecision.delayMs / 1000)} 秒执行` } });
    await writeExecutionLog({
      accountId: plan.accountId,
      planId: plan.id,
      actionType: "PLAN_DELAYED",
      requestPayload: {
        planType: plan.planType,
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

  const timing = await waitForAccountExecutionWindow(plan.account.id, `plan:${plan.id}`, {
    scheduleWindowEnabled: plan.account.scheduleWindowEnabled,
    executionWindowStart: plan.account.executionWindowStart,
    executionWindowEnd: plan.account.executionWindowEnd,
    baseJitterSec: plan.account.baseJitterSec,
  });

  const cancelledAfterWait = await getCancelledPlan(id);
  if (cancelledAfterWait) return toCancelledResult(cancelledAfterWait);

  if (plan.planType === "FIRST_COMMENT") {
    const planDateText = getBusinessDateText(plan.planDate);

    if (!plan.task) {
      const updated = await prisma.dailyPlan.update({ where: { id }, data: { status: "FAILED", resultMessage: "首评计划未绑定任务配置" }, include: planInclude });
      await writeExecutionLog({ accountId: updated.accountId, planId: updated.id, actionType: "FIRST_COMMENT_EXECUTE_FAILED", requestPayload: { planType: updated.planType, trigger: "manual_or_auto", timing }, success: false, errorMessage: updated.resultMessage || "首评执行失败" });
      return { ok: true as const, success: false, message: updated.resultMessage || "首评执行失败", data: updated };
    }

    if (!plan.account.cookieEncrypted) {
      const updated = await prisma.dailyPlan.update({ where: { id }, data: { status: "FAILED", resultMessage: "账号未录入 Cookie" }, include: planInclude });
      await writeExecutionLog({ accountId: updated.accountId, planId: updated.id, actionType: "FIRST_COMMENT_EXECUTE_FAILED", requestPayload: { planType: updated.planType, trigger: "manual_or_auto", timing }, responsePayload: attachRiskMetaToPayload(null, await classifyAndApplyAccountRisk({ accountId: updated.accountId, success: false, message: updated.resultMessage })), success: false, errorMessage: updated.resultMessage || "首评执行失败" });
      return { ok: true as const, success: false, message: updated.resultMessage || "首评执行失败", data: updated };
    }

    const templates = (await prisma.copywritingTemplate.findMany({
      where: { status: "ACTIVE", OR: [{ tags: { has: "首评文案" } }, { tags: { has: "FIRST_COMMENT" } }] },
      select: { content: true },
    })).map((item) => item.content.trim()).filter(Boolean);

    if (!plan.task.firstCommentEnabled || templates.length === 0) {
      const updated = await prisma.dailyPlan.update({ where: { id }, data: { status: "FAILED", resultMessage: "首评任务未启用或文案库缺少“首评文案”" }, include: planInclude });
      await writeExecutionLog({ accountId: updated.accountId, planId: updated.id, actionType: "FIRST_COMMENT_EXECUTE_FAILED", requestPayload: { planType: updated.planType, trigger: "manual_or_auto", timing }, responsePayload: attachRiskMetaToPayload(null, await classifyAndApplyAccountRisk({ accountId: updated.accountId, success: false, message: updated.resultMessage })), success: false, errorMessage: updated.resultMessage || "首评执行失败" });
      return { ok: true as const, success: false, message: updated.resultMessage || "首评执行失败", data: updated };
    }

    const topicUrl = plan.task.superTopic.topicUrl || "https://weibo.com/";
    let cookie: string;

    try {
      cookie = decryptText(plan.account.cookieEncrypted);
    } catch (error) {
      const resultMessage = getDecryptErrorMessage(error);
      const updated = await prisma.dailyPlan.update({ where: { id }, data: { status: "FAILED", resultMessage }, include: planInclude });
      await writeExecutionLog({ accountId: updated.accountId, planId: updated.id, actionType: "FIRST_COMMENT_EXECUTE_FAILED", requestPayload: { planType: updated.planType, trigger: "manual_or_auto", timing }, success: false, errorMessage: resultMessage });
      return { ok: true as const, success: false, message: updated.resultMessage || "首评执行失败", data: updated };
    }

    const proxyConfig = await getProxyConfigForAccount(plan.accountId);
    const latestPosts = await fetchLatestPosts(topicUrl, cookie, 50, proxyConfig);
    const riskRules = await getRiskRules();
    const locks = await prisma.firstCommentPostLock.findMany({
      where: { planDate: plan.planDate, superTopicId: plan.task.superTopicId },
      select: { statusId: true },
    });
    const usedIds = new Set(locks.map((item) => item.statusId));

    let executed = false;
    let message = "未找到可用的 0 回复帖子";
    let payload: unknown;

    for (const candidate of latestPosts) {
      if (usedIds.has(candidate.id)) continue;

      const isZeroComments = await checkStatusIsZeroComments(candidate.id, cookie, topicUrl, candidate.commentsCount, proxyConfig);
      if (!isZeroComments) continue;

      let lockCreated = false;
      try {
        await prisma.firstCommentPostLock.create({
          data: {
            planDate: plan.planDate,
            superTopicId: plan.task.superTopicId,
            statusId: candidate.id,
            accountId: plan.accountId,
            taskId: plan.task.id,
          },
        });
        lockCreated = true;
      } catch {
        continue;
      }

      const commentText = pickRandomTemplate(templates);
      const commentResult = await sendFirstComment(candidate.id, candidate.targetUrl || topicUrl, commentText, cookie, proxyConfig);
      await recordExecutionOutcome({ accountId: plan.accountId, proxyNodeId: plan.account.proxyNodeId, success: commentResult.success, errorClass: commentResult.success ? "SUCCESS" : "UNKNOWN_FAILURE" });
      payload = {
        ...(commentResult.payload && typeof commentResult.payload === "object" ? (commentResult.payload as Record<string, unknown>) : { raw: commentResult.payload }),
        traffic: commentResult.traffic,
      };

      if (commentResult.success) {
        executed = true;
        message = `首评成功：${plan.account.nickname}`;
        break;
      }

      message = `首评请求失败，HTTP ${commentResult.status}`;

      if (lockCreated) {
        await prisma.firstCommentPostLock.deleteMany({
          where: {
            planDate: plan.planDate,
            superTopicId: plan.task.superTopicId,
            statusId: candidate.id,
            accountId: plan.accountId,
            taskId: plan.task.id,
          },
        });
      }
    }

    const updated = await prisma.dailyPlan.update({ where: { id }, data: { status: executed ? "SUCCESS" : "FAILED", resultMessage: message }, include: planInclude });
    const firstCommentRiskMeta = await classifyAndApplyAccountRisk({ accountId: updated.accountId, success: executed, message, responsePayload: payload });
    await writeExecutionLog({
      accountId: updated.accountId,
      planId: updated.id,
      actionType: executed ? "FIRST_COMMENT_EXECUTE_SUCCESS" : "FIRST_COMMENT_EXECUTE_FAILED",
      requestPayload: { planType: updated.planType, planDate: planDateText, trigger: "manual_or_auto", timing, scheduleDecision, riskClass: firstCommentRiskMeta.errorClass },
      responsePayload: attachRiskMetaToPayload(payload, firstCommentRiskMeta),
      success: executed,
      errorMessage: executed ? undefined : message,
    });

    return { ok: true as const, success: executed, message, data: updated };
  }

  const executor = getExecutor();
  const executionResult = await executor.executePlan({
    planId: plan.id,
    accountId: plan.account.id,
    accountNickname: plan.account.nickname,
    accountLoginStatus: plan.account.loginStatus,
    planType: plan.planType,
    topicName: plan.task?.superTopic?.name || "未绑定超话",
    topicUrl: plan.task?.superTopic?.topicUrl || "https://weibo.com/",
    content: plan.content?.content,
    targetUrl: plan.targetUrl || undefined,
  });

  const updated = await prisma.dailyPlan.update({
    where: { id },
    data: { status: executionResult.status, resultMessage: executionResult.message },
    include: planInclude,
  });

  const riskMeta = await classifyAndApplyAccountRisk({ accountId: plan.account.id, success: executionResult.success, message: executionResult.message, responsePayload: executionResult.responsePayload });
  await recordExecutionOutcome({ accountId: plan.account.id, proxyNodeId: plan.account.proxyNodeId, success: executionResult.success, errorClass: riskMeta.errorClass });

  await writeExecutionLog({
    accountId: updated.accountId,
    planId: updated.id,
    actionType: executionResult.stage === "PRECHECK_BLOCKED" ? "PLAN_EXECUTE_BLOCKED" : "PLAN_EXECUTE_PRECHECKED",
    requestPayload: { planType: updated.planType, trigger: "manual_or_auto", timing, scheduleDecision, stage: executionResult.stage },
    responsePayload: attachRiskMetaToPayload(executionResult.responsePayload, riskMeta),
    success: executionResult.success,
    errorMessage: executionResult.success ? undefined : executionResult.message,
  });

  return { ok: true as const, success: executionResult.success, message: executionResult.message, data: updated };
}
