import { prisma } from "@/lib/prisma";
import { decryptText } from "@/lib/encrypt";
import { getExecutor } from "@/server/executors";
import { writeExecutionLog } from "@/server/logs";
import { getProxyConfigForAccount } from "@/server/proxy-config";
import { attachRiskMetaToPayload, classifyAndApplyAccountRisk } from "@/server/risk/account-risk";
import { waitForAccountExecutionWindow } from "@/server/task-scheduler/account-timing";
import { checkStatusIsZeroComments, extractStatusIdFromUrl, fetchLatestPosts, pickRandomTemplate, sendFirstComment } from "@/server/plans/first-comment-plan";

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
  const plan = await prisma.dailyPlan.findUnique({
    where: { id },
    include: planInclude,
  });

  if (!plan || plan.status !== "CANCELLED") {
    return null;
  }

  return plan;
}

function toCancelledResult(plan: Awaited<ReturnType<typeof getCancelledPlan>>) {
  return {
    ok: true as const,
    success: false,
    message: plan?.resultMessage || "计划已停止",
    data: plan,
  };
}

function toDateText(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function executePlanById(id: string, ownerUserId?: string) {
  const plan = await prisma.dailyPlan.findUnique({
    where: { id },
    include: planInclude,
  });

  if (!plan) {
    return {
      ok: false as const,
      status: 404,
      message: "计划不存在",
    };
  }

  if (ownerUserId && plan.account.ownerUserId !== ownerUserId) {
    return {
      ok: false as const,
      status: 404,
      message: "计划不存在",
    };
  }

  if (plan.status === "CANCELLED") {
    return toCancelledResult(plan);
  }

  await prisma.dailyPlan.update({
    where: { id },
    data: {
      status: "RUNNING",
      resultMessage: "执行中，支持手动停止",
    },
  });

  const timing = await waitForAccountExecutionWindow(plan.account.id, `plan:${plan.id}`, {
    scheduleWindowEnabled: plan.account.scheduleWindowEnabled,
    executionWindowStart: plan.account.executionWindowStart,
    executionWindowEnd: plan.account.executionWindowEnd,
    baseJitterSec: plan.account.baseJitterSec,
  });

  const cancelledAfterWait = await getCancelledPlan(id);

  if (cancelledAfterWait) {
    return toCancelledResult(cancelledAfterWait);
  }

  if (plan.planType === "FIRST_COMMENT") {
    const planDateText = toDateText(plan.planDate);

    if (!plan.task) {
      const updated = await prisma.dailyPlan.update({
        where: { id },
        data: {
          status: "FAILED",
          resultMessage: "首评计划未绑定任务配置",
        },
        include: planInclude,
      });

      return {
        ok: true as const,
        success: false,
        message: updated.resultMessage || "首评执行失败",
        data: updated,
      };
    }

    if (!plan.account.cookieEncrypted) {
      const updated = await prisma.dailyPlan.update({
        where: { id },
        data: {
          status: "FAILED",
          resultMessage: "账号未录入 Cookie",
        },
        include: planInclude,
      });

      await writeExecutionLog({
        accountId: updated.accountId,
        planId: updated.id,
        actionType: "FIRST_COMMENT_EXECUTE_FAILED",
        requestPayload: {
          planType: updated.planType,
          trigger: "manual_or_auto",
          timing,
        },
        responsePayload: attachRiskMetaToPayload(null, await classifyAndApplyAccountRisk({
          accountId: updated.accountId,
          success: false,
          message: updated.resultMessage,
        })),
        success: false,
        errorMessage: updated.resultMessage || "首评执行失败",
      });

      return {
        ok: true as const,
        success: false,
        message: updated.resultMessage || "首评执行失败",
        data: updated,
      };
    }

    const templates = (
      await prisma.copywritingTemplate.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { tags: { has: "首评文案" } },
            { tags: { has: "FIRST_COMMENT" } },
          ],
        },
        select: {
          content: true,
        },
      })
    )
      .map((item) => item.content.trim())
      .filter(Boolean);

    if (!plan.task.firstCommentEnabled || templates.length === 0) {
      const updated = await prisma.dailyPlan.update({
        where: { id },
        data: {
          status: "FAILED",
          resultMessage: "首评任务未启用或文案库缺少“首评文案”",
        },
        include: planInclude,
      });

      await writeExecutionLog({
        accountId: updated.accountId,
        planId: updated.id,
        actionType: "FIRST_COMMENT_EXECUTE_FAILED",
        requestPayload: {
          planType: updated.planType,
          trigger: "manual_or_auto",
          timing,
        },
        responsePayload: attachRiskMetaToPayload(null, await classifyAndApplyAccountRisk({
          accountId: updated.accountId,
          success: false,
          message: updated.resultMessage,
        })),
        success: false,
        errorMessage: updated.resultMessage || "首评执行失败",
      });

      return {
        ok: true as const,
        success: false,
        message: updated.resultMessage || "首评执行失败",
        data: updated,
      };
    }

    const topicUrl = plan.task.superTopic.topicUrl || "https://weibo.com/";
    const cookie = decryptText(plan.account.cookieEncrypted);
    const proxyConfig = await getProxyConfigForAccount(plan.accountId);
    const latestPosts = await fetchLatestPosts(topicUrl, cookie, 200, proxyConfig);

    const locks = await prisma.firstCommentPostLock.findMany({
      where: {
        planDate: plan.planDate,
        superTopicId: plan.task.superTopicId,
      },
      select: {
        statusId: true,
      },
    });

    const usedIds = new Set(locks.map((item) => item.statusId));
    const preferred = latestPosts.slice(0, 20);
    const expanded = latestPosts.slice(20, 200);
    const candidates = [...preferred, ...expanded];

    let executed = false;
    let message = "未找到可用的 0 回复帖子";
    let payload: unknown;

    for (const candidate of candidates) {
      const cancelledBeforeCandidate = await getCancelledPlan(id);

      if (cancelledBeforeCandidate) {
        return toCancelledResult(cancelledBeforeCandidate);
      }

      if (usedIds.has(candidate.id)) {
        continue;
      }

      const isZeroComments = await checkStatusIsZeroComments(candidate.id, cookie, topicUrl, candidate.commentsCount, proxyConfig);

      if (!isZeroComments) {
        continue;
      }

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
      payload = {
        ...(commentResult.payload && typeof commentResult.payload === "object" ? (commentResult.payload as Record<string, unknown>) : { raw: commentResult.payload }),
        traffic: commentResult.traffic,
      };

      const cancelledAfterComment = await getCancelledPlan(id);

      if (cancelledAfterComment) {
        return toCancelledResult(cancelledAfterComment);
      }

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

    const cancelledBeforeFinalize = await getCancelledPlan(id);

    if (cancelledBeforeFinalize) {
      return toCancelledResult(cancelledBeforeFinalize);
    }

    const updated = await prisma.dailyPlan.update({
      where: { id },
      data: {
        status: executed ? "SUCCESS" : "FAILED",
        resultMessage: message,
      },
      include: planInclude,
    });

    const firstCommentRiskMeta = await classifyAndApplyAccountRisk({
      accountId: updated.accountId,
      success: executed,
      message,
      responsePayload: payload,
    });

    await writeExecutionLog({
      accountId: updated.accountId,
      planId: updated.id,
      actionType: executed ? "FIRST_COMMENT_EXECUTE_SUCCESS" : "FIRST_COMMENT_EXECUTE_FAILED",
      requestPayload: {
        planType: updated.planType,
        planDate: planDateText,
        trigger: "manual_or_auto",
        timing,
        riskClass: firstCommentRiskMeta.errorClass,
      },
      responsePayload: attachRiskMetaToPayload(payload, firstCommentRiskMeta),
      success: executed,
      errorMessage: executed ? undefined : message,
    });

    return {
      ok: true as const,
      success: executed,
      message,
      data: updated,
    };
  }

  const executor = getExecutor();
  let resolvedTargetUrl = plan.targetUrl || null;

  if ((plan.planType === "LIKE" || plan.planType === "COMMENT") && !extractStatusIdFromUrl(resolvedTargetUrl || "")) {
    const topicUrl = plan.task?.superTopic.topicUrl || "https://weibo.com/";

    if (plan.account.cookieEncrypted) {
      try {
        const cookie = decryptText(plan.account.cookieEncrypted);
        const proxyConfig = await getProxyConfigForAccount(plan.accountId);
        const posts = await fetchLatestPosts(topicUrl, cookie, 30, proxyConfig);
        resolvedTargetUrl = posts[0]?.targetUrl || topicUrl;
      } catch {
        resolvedTargetUrl = resolvedTargetUrl || topicUrl;
      }
    } else {
      resolvedTargetUrl = resolvedTargetUrl || topicUrl;
    }
  }

  const executionResult =
    plan.planType === "COMMENT"
      ? await executor.executeInteraction({
          interactionTaskId: plan.id,
          accountId: plan.accountId,
          accountNickname: plan.account.nickname,
          accountLoginStatus: plan.account.loginStatus,
          actionType: "COMMENT",
          targetUrl: resolvedTargetUrl || plan.targetUrl || plan.task?.superTopic.topicUrl || "https://weibo.com/",
          commentText: plan.content?.content || null,
        })
      : await executor.executePlan({
          planId: plan.id,
          accountId: plan.accountId,
          accountNickname: plan.account.nickname,
          accountLoginStatus: plan.account.loginStatus,
          planType: plan.planType,
          targetUrl: resolvedTargetUrl,
          content: plan.content?.content || null,
          topicName: plan.task?.superTopic.name || null,
          topicUrl: plan.task?.superTopic.topicUrl || null,
        });

  const cancelledBeforeFinalize = await getCancelledPlan(id);

  if (cancelledBeforeFinalize) {
    return toCancelledResult(cancelledBeforeFinalize);
  }

  const updated = await prisma.dailyPlan.update({
    where: { id },
    data: {
      status: executionResult.status,
      resultMessage: executionResult.message,
    },
    include: planInclude,
  });

  const actionType = executionResult.stage === "PRECHECK_BLOCKED" ? "PLAN_EXECUTE_BLOCKED" : "PLAN_EXECUTE_PRECHECKED";
  const riskMeta = await classifyAndApplyAccountRisk({
    accountId: updated.accountId,
    success: executionResult.success,
    message: executionResult.message,
    responsePayload: executionResult.responsePayload,
  });

  await writeExecutionLog({
    accountId: updated.accountId,
    planId: updated.id,
    actionType,
    requestPayload: {
      planType: updated.planType,
      stage: executionResult.stage,
      trigger: "manual_or_auto",
      timing,
      targetUrl: resolvedTargetUrl || plan.targetUrl,
      riskClass: riskMeta.errorClass,
    },
    responsePayload: attachRiskMetaToPayload(executionResult.responsePayload, riskMeta),
    success: executionResult.success,
    errorMessage: executionResult.success ? undefined : executionResult.message,
  });

  return {
    ok: true as const,
    success: executionResult.success,
    message: executionResult.message,
    data: updated,
  };
}
