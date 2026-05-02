import { cancelTask } from "@/src/lib/task-scheduler";
import { writeExecutionLog } from "@/src/lib/execution-log";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

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
          select: { id: true, ownerUserId: true },
        },
      },
    });

    if (!existing || existing.account.ownerUserId !== auth.session.id) {
      return Response.json({ success: false, message: "互动任务不存在" }, { status: 404 });
    }

    const task = await prisma.interactionTask.update({
      where: { id },
      data: {
        status: "CANCELLED",
        resultMessage: "已人工停止",
      },
      include: interactionInclude,
    });

    await cancelTask({
      kind: "INTERACTION",
      id,
      ownerUserId: auth.session.id,
    });

    await writeExecutionLog({
      accountId: task.accountId,
      actionType: "INTERACTION_STOPPED",
      success: true,
    });

    return Response.json({ success: true, data: task, message: "互动任务已停止" });
  } catch {
    return Response.json({ success: false, message: "停止互动任务失败" }, { status: 500 });
  }
}
