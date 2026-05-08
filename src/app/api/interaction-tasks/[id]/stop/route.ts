import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { writeExecutionLog } from "@/server/logs";
import { cancelTask } from "@/server/task-scheduler";

const interactionInclude = {
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

export async function POST(_request: Request, context: RouteContext<"/api/interaction-tasks/[id]/stop">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const existing = await prisma.interactionTask.findUnique({
      where: { id },
      include: {
        account: {
          select: {
            id: true,
            ownerUserId: true,
          },
        },
      },
    });

    if (!existing || existing.account.ownerUserId !== auth.session.id) {
      return Response.json({ success: false, message: "互动任务不存在" }, { status: 404 });
    }

    if (!existing.account.ownerUserId) {
      return Response.json({ success: false, message: "互动任务不存在" }, { status: 404 });
    }

    const cancelled = await cancelTask({
      kind: "INTERACTION",
      id,
      ownerUserId: existing.account.ownerUserId,
    });

    if (cancelled.removed > 0) {
      const task = await prisma.interactionTask.update({
        where: { id },
        data: {
          status: "CANCELLED",
          resultMessage: "已停止（队列中移除）",
        },
        include: interactionInclude,
      });

      await writeExecutionLog({
        accountId: task.accountId,
        actionType: "INTERACTION_STOPPED",
        success: true,
      });

      return Response.json({ success: true, data: task, message: "互动任务已停止" });
    }

    if (existing.status === "RUNNING") {
      const task = await prisma.interactionTask.update({
        where: { id },
        data: {
          resultMessage: "已请求停止；若当前动作已发出，仍可能继续完成",
        },
        include: interactionInclude,
      });

      await writeExecutionLog({
        accountId: task.accountId,
        actionType: "INTERACTION_STOPPED",
        success: true,
        errorMessage: "运行中互动任务仅记录停止请求，当前动作可能继续完成",
      });

      return Response.json({
        success: true,
        data: task,
        message: "已记录停止请求；若当前动作已发出，仍可能继续完成",
      });
    }

    const currentTask = await prisma.interactionTask.findUnique({ where: { id }, include: interactionInclude });

    if (!currentTask) {
      return Response.json({ success: false, message: "互动任务不存在" }, { status: 404 });
    }

    return Response.json({ success: true, data: currentTask, message: currentTask.resultMessage || "互动任务状态未变化" });
  } catch {
    return Response.json({ success: false, message: "停止互动任务失败" }, { status: 500 });
  }
}
