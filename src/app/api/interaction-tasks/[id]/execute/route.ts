import { prisma } from "@/lib/prisma";
import { getExecutor } from "@/server/executors";
import { writeExecutionLog } from "@/server/logs";

export async function POST(_request: Request, context: RouteContext<"/api/interaction-tasks/[id]/execute">) {
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

    if (task.account.loginStatus !== "ONLINE") {
      await writeExecutionLog({
        accountId: task.accountId,
        actionType: "INTERACTION_EXECUTE_BLOCKED",
        success: false,
        errorMessage: "账号登录态无效，无法执行互动任务",
      });

      return Response.json({ success: false, message: "账号登录态无效，请先检测并更新 Cookie" }, { status: 400 });
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

    await writeExecutionLog({
      accountId: updated.accountId,
      actionType: "INTERACTION_EXECUTE_PRECHECKED",
      requestPayload: { actionType: updated.actionType, targetUrl: updated.target.targetUrl },
      responsePayload: executionResult.responsePayload,
      success: executionResult.success,
    });

    return Response.json({ success: true, data: updated, message: executionResult.message });
  } catch {
    return Response.json({ success: false, message: "执行互动任务失败" }, { status: 500 });
  }
}
