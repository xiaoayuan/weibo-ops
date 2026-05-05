import { prisma } from "@/lib/prisma";
import { decryptText, getDecryptErrorMessage } from "@/lib/encrypt";
import { formatBusinessDateTime, getBusinessDateText, toBusinessDateTime } from "@/lib/business-date";
import { getExecutor } from "@/server/executors";
import { writeExecutionLog } from "@/server/logs";
import { getProxyConfigForAccount } from "@/server/proxy-config";
import { attachRiskMetaToPayload, classifyAndApplyAccountRisk } from "@/server/risk/account-risk";
import { classifyExecutionOutcome } from "@/server/risk/error-classifier";
import { getRiskRules } from "@/server/risk/rules";
import { isAccountCircuitOpen, isProxyCircuitOpen, recordExecutionOutcome } from "@/server/risk/circuit-breaker";
import { waitForAccountExecutionWindow } from "@/server/task-scheduler/account-timing";
import { reserveRateLimitedExecution, resolvePlanTaskType } from "@/server/task-scheduler/rate-limit";
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

function toCancelledResult(plan: Awaited<ReturnType<typeof getCancelledPlan>>, commentSuccess?: boolean) {
  return {
    ok: true as const,
    // 如果评论已经成功发送，即使计划随后被取消也应报告成功
    success: commentSuccess === true,
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNextFirstCommentRetryTime(input: { now: Date; planDate: Date; endTime?: string | null }) {
  const next = new Date(input.now.getTime() + 30 * 60 * 1000);
  const endBoundary = toBusinessDateTime(getBusinessDateText(input.planDate), input.endTime || "18:00");

  if (next.getTime() > endBoundary.getTime()) {
    return null;
  }

  return next;
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

  if (await isAccountCircuitOpen(plan.accountId)) {
    const updated = await prisma.dailyPlan.update({
      where: { id },
      data: { status: "FAILED", resultMessage: "账号熔断中，计划已自动暂停" },
      include: planInclude,
    });

    await writeExecutionLog({
      accountId: updated.accountId,
      planId: updated.id,
      actionType: "PLAN_EXECUTE_BLOCKED",
      requestPayload: {
        planType: updated.planType,
        trigger: "manual_or_auto",
        reason: "ACCOUNT_CIRCUIT_OPEN",
      },
      success: false,
      errorMessage: updated.resultMessage || "计划已暂停",
    });

    return {
      ok: true as const,
      success: false,
      message: updated.resultMessage || "计划已暂停",
      data: updated,
    };
  }

  if (await isProxyCircuitOpen(plan.account.proxyNodeId)) {
    const updated = await prisma.dailyPlan.update({
      where: { id },
      data: { status: "FAILED", resultMessage: "代理熔断中，计划已自动暂停" },
      include: planInclude,
    });

    await writeExecutionLog({
      accountId: updated.accountId,
      planId: updated.id,
      actionType: "PLAN_EXECUTE_BLOCKED",
      requestPayload: {
        planType: updated.planType,
        trigger: "manual_or_auto",
        reason: "PROXY_CIRCUIT_OPEN",
      },
      success: false,
      errorMessage: updated.resultMessage || "计划已暂停",
    });

    return {
      ok: true as const,
      success: false,
      message: updated.resultMessage || "计划已暂停",
      data: updated,
    };
  }

  await prisma.dailyPlan.update({
    where: { id },
    data: {
      status: "RUNNING",
      resultMessage: "执行中，支持手动停止",
    },
  });

  const scheduleDecision = await reserveRateLimitedExecution({
    ownerUserId: plan.account.ownerUserId || `account:${plan.accountId}`,
    taskType: resolvePlanTaskType(plan.planType),
    baseTier: "B",
  });

  if (scheduleDecision.delayMs > 0) {
    await prisma.dailyPlan.update({
      where: { id },
      data: {
        resultMessage: `调度限速生效，已延后 ${Math.ceil(scheduleDecision.delayMs / 1000)} 秒执行`,
      },
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

      await writeExecutionLog({
        accountId: updated.accountId,
        planId: updated.id,
        actionType: "FIRST_COMMENT_EXECUTE_FAILED",
        requestPayload: {
          planType: updated.planType,
          trigger: "manual_or_auto",
          timing,
        },
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
    let cookie: string;

    try {
      cookie = decryptText(plan.account.cookieEncrypted);
    } catch (error) {
      const resultMessage = getDecryptErrorMessage(error);
      const updated = await prisma.dailyPlan.update({
        where: { id },
        data: {
          status: "FAILED",
          resultMessage,
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
        success: false,
        errorMessage: resultMessage,
      });

      return {
        ok: true as const,
        success: false,
        message: updated.resultMessage || "首评执行失败",
        data: updated,
      };
    }

    const proxyConfig = await getProxyConfigForAccount(plan.accountId);
    const latestPosts = await fetchLatestPosts(topicUrl, cookie, 100, proxyConfig);
    const riskRules = await getRiskRules();

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
    const expanded = latestPosts.slice(20, 100);
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
      const commentErrorClass = classifyExecutionOutcome(
        {
          success: commentResult.success,
          message: commentResult.success ? undefined : `首评请求失败，HTTP ${commentResult.status}`,
          responsePayload: commentResult.payload,
        },
        riskRules,
      );
      await recordExecutionOutcome({
        accountId: plan.accountId,
        proxyNodeId: plan.account.proxyNodeId,
        success: commentResult.success,
        errorClass: commentErrorClass,
      });
      payload = {
        ...(commentResult.payload && typeof commentResult.payload === "object" ? (commentResult.payload as Record<string, unknown>) : { raw: commentResult.payload }),
        traffic: commentResult.traffic,
      };

      if (commentResult.success) {
        executed = true;
        message = `首评成功：${plan.account.nickname}`;

        // 评论成功后也要检查是否被取消——即使取消也要报告评论已发出
        const cancelledAfterComment = await getCancelledPlan(id);
        if (cancelledAfterComment) {
          return toCancelledResult(cancelledAfterComment, commentResult.success);
        }

        break;
      }

      const cancelledAfterComment = await getCancelledPlan(id);
      if (cancelledAfterComment) {
        return toCancelledResult(cancelledAfterComment, false);
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

    const shouldRetryNoTarget = !executed && message === "未找到可用的 0 回复帖子";

    if (shouldRetryNoTarget) {
      const retryAt = getNextFirstCommentRetryTime({ now: new Date(), planDate: plan.planDate, endTime: plan.task?.endTime || null });

      if (retryAt) {
        const retryMessage = `暂未命中可首评帖子，已顺延至 ${formatBusinessDateTime(retryAt)} 再试`;
        const updated = await prisma.dailyPlan.update({
          where: { id },
          data: {
            status: "PENDING",
            scheduledTime: retryAt,
            resultMessage: retryMessage,
          },
          include: planInclude,
        });

        await writeExecutionLog({
          accountId: updated.accountId,
          planId: updated.id,
          actionType: "FIRST_COMMENT_REQUEUED",
          requestPayload: {
            planType: updated.planType,
            trigger: "manual_or_auto",
            retryAt: retryAt.toISOString(),
            timing,
            scheduleDecision,
          },
          success: true,
          errorMessage: retryMessage,
        });

        return {
          ok: true as const,
          success: false,
          message: retryMessage,
          data: updated,
        };
      }

      message = "当天窗口内未命中可首评帖子，已结束执行";
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
        scheduleDecision,
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

  if ((plan.planType === "LIKE" || plan.planType === "COMMENT" || plan.planType === "REPOST") && !extractStatusIdFromUrl(resolvedTargetUrl || "")) {
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
      : plan.planType === "REPOST"
        ? await executor.executeInteraction({
            interactionTaskId: plan.id,
            accountId: plan.accountId,
            accountNickname: plan.account.nickname,
            accountLoginStatus: plan.account.loginStatus,
            actionType: "REPOST",
            targetUrl: resolvedTargetUrl || plan.targetUrl || plan.task?.superTopic.topicUrl || "https://weibo.com/",
            repostContent: plan.content?.content || null,
          })
        : await executor.executePlan({
          planId: plan.id,
          accountId: plan.accountId,
          accountNickname: plan.account.nickname,
          accountLoginStatus: plan.account.loginStatus,
          planType: plan.planType,
          targetUrl: resolvedTargetUrl || undefined,
          content: plan.content?.content ?? undefined,
          topicName: plan.task?.superTopic.name ?? "",
          topicUrl: plan.task?.superTopic.topicUrl ?? "",
          postingUrl: plan.task?.superTopic.postingUrl ?? undefined,
        });

  const riskRules = await getRiskRules();
  const errorClass = classifyExecutionOutcome(
    {
      success: executionResult.success,
      message: executionResult.message,
      responsePayload: executionResult.responsePayload,
    },
    riskRules,
  );

  if (!executionResult.success && executionResult.status === "FAILED" && (errorClass === "TRANSIENT_NETWORK" || errorClass === "PLATFORM_BUSY")) {
    const retryCount = await prisma.executionLog.count({
      where: {
        planId: plan.id,
        actionType: "PLAN_REQUEUED",
      },
    });

    if (retryCount < 1) {
      const retryAt = getNextFirstCommentRetryTime({ now: new Date(), planDate: plan.planDate, endTime: plan.task?.endTime || null });

      if (retryAt) {
        const retryMessage = `执行失败（${executionResult.message || "未知错误"}），已自动重试一次，顺延至 ${formatBusinessDateTime(retryAt)}`;
        const updated = await prisma.dailyPlan.update({
          where: { id },
          data: {
            status: "PENDING",
            scheduledTime: retryAt,
            resultMessage: retryMessage,
          },
          include: planInclude,
        });

        await writeExecutionLog({
          accountId: updated.accountId,
          planId: updated.id,
          actionType: "PLAN_REQUEUED",
          requestPayload: {
            planType: updated.planType,
            trigger: "manual_or_auto",
            retryAt: retryAt.toISOString(),
            reasonClass: errorClass,
            message: executionResult.message,
            timing,
            scheduleDecision,
          },
          success: true,
          errorMessage: retryMessage,
        });

        return {
          ok: true as const,
          success: false,
          message: retryMessage,
          data: updated,
        };
      }
    }
  }

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
  await recordExecutionOutcome({
    accountId: updated.accountId,
    proxyNodeId: updated.account.proxyNodeId,
    success: executionResult.success,
    errorClass: riskMeta.errorClass || errorClass,
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
      scheduleDecision,
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
