import { prisma } from "@/lib/prisma";
import { getExecutor } from "@/server/executors";
import { writeExecutionLog } from "@/server/logs";

export async function POST(_request: Request, context: RouteContext<"/api/plans/[id]/execute">) {
  const { id } = await context.params;

  try {
    const plan = await prisma.dailyPlan.findUnique({
      where: { id },
      include: {
        account: true,
      },
    });

    if (!plan) {
      return Response.json({ success: false, message: "计划不存在" }, { status: 404 });
    }

    if (plan.account.loginStatus !== "ONLINE") {
      await writeExecutionLog({
        accountId: plan.accountId,
        planId: plan.id,
        actionType: "PLAN_EXECUTE_BLOCKED",
        success: false,
        errorMessage: "账号登录态无效，无法执行计划",
      });

      return Response.json({ success: false, message: "账号登录态无效，请先检测并更新 Cookie" }, { status: 400 });
    }

    const executor = getExecutor();
    const executionResult = await executor.executePlan({
      planId: plan.id,
      accountId: plan.accountId,
      accountNickname: plan.account.nickname,
      accountLoginStatus: plan.account.loginStatus,
      planType: plan.planType,
      targetUrl: plan.targetUrl,
      content: null,
      topicName: null,
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

    await writeExecutionLog({
      accountId: updated.accountId,
      planId: updated.id,
      actionType: "PLAN_EXECUTE_PRECHECKED",
      requestPayload: { planType: updated.planType },
      responsePayload: executionResult.responsePayload,
      success: executionResult.success,
    });

    return Response.json({ success: true, data: updated, message: executionResult.message });
  } catch {
    return Response.json({ success: false, message: "执行计划失败" }, { status: 500 });
  }
}
