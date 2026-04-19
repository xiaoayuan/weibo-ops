import { prisma } from "@/lib/prisma";
import { getExecutor } from "@/server/executors";
import { writeExecutionLog } from "@/server/logs";

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
