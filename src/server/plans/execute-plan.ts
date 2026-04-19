import { prisma } from "@/lib/prisma";
import { decryptText } from "@/lib/encrypt";
import { getExecutor } from "@/server/executors";
import { writeExecutionLog } from "@/server/logs";
import { fetchLatestPosts, pickRandomTemplate, sendFirstComment } from "@/server/plans/first-comment-plan";

function toDateText(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function executePlanById(id: string) {
  const plan = await prisma.dailyPlan.findUnique({
    where: { id },
    include: {
      account: true,
      content: true,
      task: {
        include: {
          superTopic: true,
        },
      },
    },
  });

  if (!plan) {
    return {
      ok: false as const,
      status: 404,
      message: "计划不存在",
    };
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
        include: {
          account: true,
          content: true,
          task: {
            include: {
              superTopic: true,
            },
          },
        },
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
        include: {
          account: true,
          content: true,
          task: {
            include: {
              superTopic: true,
            },
          },
        },
      });

      await writeExecutionLog({
        accountId: updated.accountId,
        planId: updated.id,
        actionType: "FIRST_COMMENT_EXECUTE_FAILED",
        requestPayload: {
          planType: updated.planType,
          trigger: "manual_or_auto",
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

    const templates = plan.task.firstCommentTemplates.map((item) => item.trim()).filter(Boolean);

    if (!plan.task.firstCommentEnabled || templates.length === 0) {
      const updated = await prisma.dailyPlan.update({
        where: { id },
        data: {
          status: "FAILED",
          resultMessage: "首评任务未启用或文案池为空",
        },
        include: {
          account: true,
          content: true,
          task: {
            include: {
              superTopic: true,
            },
          },
        },
      });

      await writeExecutionLog({
        accountId: updated.accountId,
        planId: updated.id,
        actionType: "FIRST_COMMENT_EXECUTE_FAILED",
        requestPayload: {
          planType: updated.planType,
          trigger: "manual_or_auto",
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

    const topicUrl = plan.task.superTopic.topicUrl || "https://weibo.com/";
    const cookie = decryptText(plan.account.cookieEncrypted);
    const latestPosts = await fetchLatestPosts(topicUrl, cookie, 100);

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
    const preferred = latestPosts.slice(0, 20).filter((post) => post.commentsCount === 0);
    const expanded = latestPosts.slice(20, 100).filter((post) => post.commentsCount === 0);
    const candidates = [...preferred, ...expanded];

    let executed = false;
    let message = "未找到可用的 0 回复帖子";
    let payload: unknown;

    for (const candidate of candidates) {
      if (usedIds.has(candidate.id)) {
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
      const commentResult = await sendFirstComment(candidate.id, candidate.targetUrl || topicUrl, commentText, cookie);
      payload = commentResult.payload;

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

    const updated = await prisma.dailyPlan.update({
      where: { id },
      data: {
        status: executed ? "SUCCESS" : "FAILED",
        resultMessage: message,
      },
      include: {
        account: true,
        content: true,
        task: {
          include: {
            superTopic: true,
          },
        },
      },
    });

    await writeExecutionLog({
      accountId: updated.accountId,
      planId: updated.id,
      actionType: executed ? "FIRST_COMMENT_EXECUTE_SUCCESS" : "FIRST_COMMENT_EXECUTE_FAILED",
      requestPayload: {
        planType: updated.planType,
        planDate: planDateText,
        trigger: "manual_or_auto",
      },
      responsePayload: payload,
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
  const executionResult = await executor.executePlan({
    planId: plan.id,
    accountId: plan.accountId,
    accountNickname: plan.account.nickname,
    accountLoginStatus: plan.account.loginStatus,
    planType: plan.planType,
    targetUrl: plan.targetUrl,
    content: plan.content?.content || null,
    topicName: plan.task?.superTopic.name || null,
    topicUrl: plan.task?.superTopic.topicUrl || null,
  });

  const updated = await prisma.dailyPlan.update({
    where: { id },
    data: {
      status: executionResult.status,
      resultMessage: executionResult.message,
    },
    include: {
      account: true,
      content: true,
      task: {
        include: {
          superTopic: true,
        },
      },
    },
  });

  const actionType = executionResult.stage === "PRECHECK_BLOCKED" ? "PLAN_EXECUTE_BLOCKED" : "PLAN_EXECUTE_PRECHECKED";

  await writeExecutionLog({
    accountId: updated.accountId,
    planId: updated.id,
    actionType,
    requestPayload: {
      planType: updated.planType,
      stage: executionResult.stage,
      trigger: "manual_or_auto",
    },
    responsePayload: executionResult.responsePayload,
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
