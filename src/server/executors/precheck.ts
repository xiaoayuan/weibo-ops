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

  if (input.planType === "POST" && !input.content?.trim()) {
    return buildBlockedResult("发帖计划缺少文案内容，无法进入真实执行阶段。", executor, "MISSING_CONTENT", {
      planId: input.planId,
      planType: input.planType,
      topicName: input.topicName,
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

  return null;
}
