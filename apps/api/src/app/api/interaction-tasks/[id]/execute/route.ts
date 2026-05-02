import { executeInteractionTaskById } from "@/src/lib/execute-interaction-task";
import { writeExecutionLog } from "@/src/lib/execution-log";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { scheduleTask } from "@/src/lib/task-scheduler";
import { ScheduledTaskCancelledError } from "@/src/lib/task-scheduler-types";

export async function POST(request: Request, context: RouteContext<"/api/interaction-tasks/[id]/execute">) {
  const auth = await requireApiRole("OPERATOR");
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    let executorAccountId: string | undefined;
    try {
      const body = (await request.json()) as { executorAccountId?: string };
      executorAccountId = body?.executorAccountId?.trim() || undefined;
    } catch {
      executorAccountId = undefined;
    }

    const task = await prisma.interactionTask.findUnique({ where: { id }, include: { account: { select: { id: true, ownerUserId: true } } } });
    if (!task) return Response.json({ success: false, message: "互动任务不存在" }, { status: 404 });
    if (task.account.ownerUserId !== auth.session.id) return Response.json({ success: false, message: "互动任务不属于当前用户" }, { status: 403 });

    const scheduled = await scheduleTask({
      kind: "INTERACTION",
      id,
      ownerUserId: auth.session.id,
      label: `interaction:${id}`,
      run: () => executeInteractionTaskById(id, auth.session.id, executorAccountId),
    });

    await writeExecutionLog({
      accountId: task.account.id,
      actionType: "INTERACTION_SCHEDULED",
      requestPayload: { taskId: id, ownerUserId: auth.session.id, executorAccountId, workerId: scheduled.workerId, userConcurrency: scheduled.userConcurrency, queueDepth: scheduled.queueDepth },
      success: true,
    });

    if (!scheduled.data.ok) {
      return Response.json({ success: false, message: scheduled.data.message, workerId: scheduled.workerId, userConcurrency: scheduled.userConcurrency, queueDepth: scheduled.queueDepth }, { status: scheduled.data.status });
    }

    return Response.json({ success: scheduled.data.success, data: scheduled.data.data, message: scheduled.data.message, workerId: scheduled.workerId, userConcurrency: scheduled.userConcurrency, queueDepth: scheduled.queueDepth });
  } catch (error) {
    if (error instanceof ScheduledTaskCancelledError) {
      const task = await prisma.interactionTask.findUnique({
        where: { id },
        include: {
          account: { select: { id: true, nickname: true, status: true, loginStatus: true, ownerUserId: true } },
          target: true,
          content: true,
        },
      });

      return Response.json({ success: false, data: task, message: task?.resultMessage || "互动任务已停止" });
    }

    return Response.json({ success: false, message: "执行互动任务失败" }, { status: 500 });
  }
}
