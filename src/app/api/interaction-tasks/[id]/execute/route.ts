import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { executeInteractionTaskById } from "@/server/interactions/execute-task";
import { writeExecutionLog } from "@/server/logs";
import { scheduleTaskDetached } from "@/server/task-scheduler";
import { ScheduledTaskCancelledError } from "@/server/task-scheduler/types";

const taskInclude = {
  account: {
    select: {
      id: true,
      nickname: true,
      status: true,
      loginStatus: true,
      ownerUserId: true,
    },
  },
  target: true,
  content: true,
} as const;

function toInteractionExecuteResponse(task: Awaited<ReturnType<typeof prisma.interactionTask.findUnique>>) {
  if (!task) {
    return Response.json({ success: false, message: "互动任务不存在" }, { status: 404 });
  }

  if (task.status === "READY") {
    return Response.json({ success: true, data: task, message: task.resultMessage || "互动任务已在队列中" });
  }

  if (task.status === "RUNNING") {
    return Response.json({ success: true, data: task, message: task.resultMessage || "互动任务已在执行中" });
  }

  if (task.status === "SUCCESS") {
    return Response.json({ success: true, data: task, message: task.resultMessage || "互动任务已执行成功" });
  }

  if (task.status === "CANCELLED") {
    return Response.json({ success: false, data: task, message: task.resultMessage || "互动任务已停止" }, { status: 409 });
  }

  return Response.json({ success: false, data: task, message: task.resultMessage || "互动任务当前不可执行" }, { status: 409 });
}

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

    const queued = await prisma.interactionTask.updateMany({
      where: {
        id,
        status: {
          in: ["PENDING", "FAILED"],
        },
      },
      data: {
        status: "READY",
        resultMessage: "手动执行已入队",
      },
    });

    if (queued.count === 0) {
      const currentTask = await prisma.interactionTask.findUnique({ where: { id }, include: taskInclude });
      return toInteractionExecuteResponse(currentTask);
    }

    const scheduled = await scheduleTaskDetached({
      kind: "INTERACTION",
      id,
      ownerUserId,
      label: `interaction:${id}`,
      lane: "SLOW",
      run: () => executeInteractionTaskById(id, ownerUserId, executorAccountId),
    });

    const queuedTask = await prisma.interactionTask.findUnique({ where: { id }, include: taskInclude });

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
        trigger: "MANUAL_EXECUTE",
      },
      success: true,
    });

    return Response.json({
      success: true,
      data: queuedTask,
      message: "互动任务已入队，正在等待执行",
      workerId: scheduled.workerId,
      userConcurrency: scheduled.userConcurrency,
      queueDepth: scheduled.queueDepth,
    });
  } catch (error) {
    if (error instanceof ScheduledTaskCancelledError) {
      const task = await prisma.interactionTask.findUnique({ where: { id }, include: taskInclude });

      return Response.json({ success: false, data: task, message: task?.resultMessage || "互动任务已停止" });
    }

    return Response.json({ success: false, message: "执行互动任务失败" }, { status: 500 });
  }
}
