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
    let executorAccountId: string | undefined;

    try {
      const body = (await _request.json()) as { executorAccountId?: string };
      executorAccountId = body?.executorAccountId?.trim() || undefined;
    } catch {
      executorAccountId = undefined;
    }

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

    let executionAccount = task.account;

    if (executorAccountId) {
      const selectedAccount = await prisma.weiboAccount.findUnique({
        where: { id: executorAccountId },
      });

      if (!selectedAccount || selectedAccount.ownerUserId !== auth.session.id) {
        return Response.json({ success: false, message: "执行账号不存在或无权限" }, { status: 403 });
      }

      executionAccount = selectedAccount;
    }

    const executor = getExecutor();
    const executionResult = await executor.executeInteraction({
      interactionTaskId: task.id,
      accountId: executionAccount.id,
      accountNickname: executionAccount.nickname,
      accountLoginStatus: executionAccount.loginStatus,
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
      accountId: executionAccount.id,
      actionType,
      requestPayload: {
        actionType: updated.actionType,
        targetUrl: updated.target.targetUrl,
        sourceTaskAccountId: updated.accountId,
        executionAccountId: executionAccount.id,
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
