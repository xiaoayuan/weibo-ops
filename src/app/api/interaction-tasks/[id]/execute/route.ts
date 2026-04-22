import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { executeInteractionTaskById } from "@/server/interactions/execute-task";
import { writeExecutionLog } from "@/server/logs";
import { scheduleTask } from "@/server/task-scheduler";
import { ScheduledTaskCancelledError } from "@/server/task-scheduler/types";

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
      include: { account: { select: { id: true, ownerUserId: true } } },
    });

    if (!task) {
      return Response.json({ success: false, message: "互动任务不存在" }, { status: 404 });
    }

    const ownerUserId = task.account.ownerUserId;

    if (!ownerUserId || ownerUserId !== auth.session.id) {
      return Response.json({ success: false, message: "互动任务不属于当前用户" }, { status: 403 });
    }

    const scheduled = await scheduleTask({
      kind: "INTERACTION",
      id,
      ownerUserId,
      label: `interaction:${id}`,
      run: () => executeInteractionTaskById(id, ownerUserId, executorAccountId),
    });

    await writeExecutionLog({
      accountId: task.account.id,
      actionType: "INTERACTION_SCHEDULED",
      requestPayload: {
        taskId: id,
        ownerUserId,
        executorAccountId,
        workerId: scheduled.workerId,
        userConcurrency: scheduled.userConcurrency,
        queueDepth: scheduled.queueDepth,
      },
      success: true,
    });

    if (!scheduled.data.ok) {
      return Response.json({
        success: false,
        message: scheduled.data.message,
        workerId: scheduled.workerId,
        userConcurrency: scheduled.userConcurrency,
        queueDepth: scheduled.queueDepth,
      }, { status: scheduled.data.status });
    }

    return Response.json({
      success: scheduled.data.success,
      data: scheduled.data.data,
      message: scheduled.data.message,
      workerId: scheduled.workerId,
      userConcurrency: scheduled.userConcurrency,
      queueDepth: scheduled.queueDepth,
    });
  } catch (error) {
    if (error instanceof ScheduledTaskCancelledError) {
      const task = await prisma.interactionTask.findUnique({
        where: { id },
        include: {
          account: true,
          target: true,
          content: true,
        },
      });

      return Response.json({ success: false, data: task, message: task?.resultMessage || "互动任务已停止" });
    }

    return Response.json({ success: false, message: "执行互动任务失败" }, { status: 500 });
  }
}
