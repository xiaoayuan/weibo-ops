import type { ExecuteInteractionInput, ExecutePlanInput, ExecutorActionResult } from "@/server/executors/types";

type ExecutorName = "mock" | "weibo";

function buildBlockedResult(message: string, executor: ExecutorName, reason: string, input: Record<string, unknown>): ExecutorActionResult {
  return {
    success: false,
    status: "FAILED",
    stage: "PRECHECK_BLOCKED",
    message,
    responsePayload: {
      executor,
      reason,
      input,
    },
  };
}

export function validatePlanPrecheck(input: ExecutePlanInput, executor: ExecutorName): ExecutorActionResult | null {
  if (input.accountLoginStatus !== "ONLINE") {
    return buildBlockedResult("账号登录态无效，请先检测并更新 Cookie。", executor, "ACCOUNT_NOT_ONLINE", {
      accountId: input.accountId,
      accountLoginStatus: input.accountLoginStatus,
      planType: input.planType,
    });
  }

  if (!input.topicName?.trim()) {
    return buildBlockedResult("计划未绑定超话信息，无法进入真实执行阶段。", executor, "MISSING_TOPIC", {
      planId: input.planId,
      planType: input.planType,
    });
  }

  if (input.planType === "CHECK_IN" && !input.topicUrl?.trim()) {
    return buildBlockedResult("签到计划缺少超话链接，无法进入真实执行阶段。", executor, "MISSING_TOPIC_URL", {
      planId: input.planId,
      planType: input.planType,
      topicName: input.topicName,
    });
  }

  const trimmedContent = input.content?.trim() ?? "";

  if (input.planType === "POST" && !trimmedContent) {
    return buildBlockedResult("发帖计划缺少文案内容，无法进入真实执行阶段。", executor, "MISSING_CONTENT", {
      planId: input.planId,
      planType: input.planType,
      topicName: input.topicName,
    });
  }

  if (input.planType === "POST" && trimmedContent.length < 5) {
    return buildBlockedResult("发帖文案过短，无法进入真实执行阶段。", executor, "CONTENT_TOO_SHORT", {
      planId: input.planId,
      planType: input.planType,
      contentLength: trimmedContent.length,
    });
  }

  if (input.planType === "LIKE" && !input.targetUrl?.trim()) {
    return buildBlockedResult("点赞计划缺少目标链接，无法进入真实执行阶段。", executor, "MISSING_TARGET_URL", {
      planId: input.planId,
      planType: input.planType,
    });
  }

  return null;
}

export function validateInteractionPrecheck(input: ExecuteInteractionInput, executor: ExecutorName): ExecutorActionResult | null {
  if (input.accountLoginStatus !== "ONLINE") {
    return buildBlockedResult("账号登录态无效，请先检测并更新 Cookie。", executor, "ACCOUNT_NOT_ONLINE", {
      accountId: input.accountId,
      accountLoginStatus: input.accountLoginStatus,
      actionType: input.actionType,
    });
  }

  if (!input.targetUrl.trim()) {
    return buildBlockedResult("互动任务缺少目标链接，无法进入真实执行阶段。", executor, "MISSING_TARGET_URL", {
      interactionTaskId: input.interactionTaskId,
      actionType: input.actionType,
    });
  }

  if (!/^https?:\/\//.test(input.targetUrl.trim())) {
    return buildBlockedResult("互动任务目标链接格式无效，必须以 http 或 https 开头。", executor, "INVALID_TARGET_URL", {
      interactionTaskId: input.interactionTaskId,
      actionType: input.actionType,
      targetUrl: input.targetUrl,
    });
  }

  return null;
}
