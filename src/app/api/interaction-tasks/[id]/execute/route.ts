import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { getExecutor } from "@/server/executors";
import { writeExecutionLog } from "@/server/logs";

export async function POST(_request: Request, context: RouteContext<"/api/interaction-tasks/[id]/execute">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const task = await prisma.interactionTask.findUnique({
      where: { id },
      include: {
        account: true,
        target: true,
      },
    });

    if (!task) {
      return Response.json({ success: false, message: "互动任务不存在" }, { status: 404 });
    }

    if (task.account.ownerUserId !== auth.session.id) {
      return Response.json({ success: false, message: "互动任务不存在" }, { status: 404 });
    }

    const executor = getExecutor();
    const executionResult = await executor.executeInteraction({
      interactionTaskId: task.id,
      accountId: task.accountId,
      accountNickname: task.account.nickname,
      accountLoginStatus: task.account.loginStatus,
      actionType: task.actionType,
      targetUrl: task.target.targetUrl,
    });

    const updated = await prisma.interactionTask.update({
      where: { id },
      data: {
        status: executionResult.status,
        resultMessage: executionResult.message,
      },
      include: {
        account: true,
        target: true,
      },
    });

    const actionType = executionResult.stage === "PRECHECK_BLOCKED" ? "INTERACTION_EXECUTE_BLOCKED" : "INTERACTION_EXECUTE_PRECHECKED";

    await writeExecutionLog({
      accountId: updated.accountId,
      actionType,
      requestPayload: {
        actionType: updated.actionType,
        targetUrl: updated.target.targetUrl,
        stage: executionResult.stage,
      },
      responsePayload: executionResult.responsePayload,
      success: executionResult.success,
      errorMessage: executionResult.success ? undefined : executionResult.message,
    });

    return Response.json({ success: executionResult.success, data: updated, message: executionResult.message });
  } catch {
    return Response.json({ success: false, message: "执行互动任务失败" }, { status: 500 });
  }
}
