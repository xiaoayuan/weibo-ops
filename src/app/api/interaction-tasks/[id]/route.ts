import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { writeExecutionLog } from "@/server/logs";

const allowedStatuses = ["PENDING", "READY", "RUNNING", "SUCCESS", "FAILED", "CANCELLED"] as const;

type InteractionTaskStatus = (typeof allowedStatuses)[number];

export async function PATCH(request: Request, context: RouteContext<"/api/interaction-tasks/[id]">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const body = (await request.json()) as { status?: string; resultMessage?: string };

    if (!body.status || !allowedStatuses.includes(body.status as InteractionTaskStatus)) {
      return Response.json({ success: false, message: "状态参数无效" }, { status: 400 });
    }

    const existing = await prisma.interactionTask.findUnique({
      where: { id },
      select: {
        id: true,
        account: {
          select: {
            ownerUserId: true,
          },
        },
      },
    });

    if (!existing || existing.account.ownerUserId !== auth.session.id) {
      return Response.json({ success: false, message: "互动任务不存在" }, { status: 404 });
    }

    const status = body.status as InteractionTaskStatus;

    const task = await prisma.interactionTask.update({
      where: { id },
      data: {
        status,
        resultMessage: body.resultMessage || null,
      },
      include: {
        account: {
          select: {
            id: true,
            nickname: true,
            ownerUserId: true,
          },
        },
        target: true,
        content: true,
      },
    });

    await writeExecutionLog({
      accountId: task.accountId,
      actionType: "INTERACTION_TASK_UPDATED",
      requestPayload: body,
      success: true,
    });

    return Response.json({ success: true, data: task });
  } catch {
    return Response.json({ success: false, message: "更新互动任务失败" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/interaction-tasks/[id]">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const existing = await prisma.interactionTask.findUnique({
      where: { id },
      select: {
        id: true,
        account: {
          select: {
            ownerUserId: true,
          },
        },
      },
    });

    if (!existing || existing.account.ownerUserId !== auth.session.id) {
      return Response.json({ success: false, message: "互动任务不存在" }, { status: 404 });
    }

    const task = await prisma.interactionTask.delete({
      where: { id },
      select: {
        id: true,
        accountId: true,
      },
    });

    await writeExecutionLog({
      accountId: task.accountId,
      actionType: "INTERACTION_TASK_DELETED",
      requestPayload: { id: task.id },
      success: true,
    });

    return Response.json({ success: true, message: "删除成功" });
  } catch {
    return Response.json({ success: false, message: "删除互动任务失败" }, { status: 500 });
  }
}
