import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { getExecutor } from "@/server/executors";
import { writeExecutionLog } from "@/server/logs";

export async function POST(_request: Request, context: RouteContext<"/api/plans/[id]/execute">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
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
      return Response.json({ success: false, message: "计划不存在" }, { status: 404 });
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
      },
      responsePayload: executionResult.responsePayload,
      success: executionResult.success,
      errorMessage: executionResult.success ? undefined : executionResult.message,
    });

    return Response.json({ success: executionResult.success, data: updated, message: executionResult.message });
  } catch {
    return Response.json({ success: false, message: "执行计划失败" }, { status: 500 });
  }
}
