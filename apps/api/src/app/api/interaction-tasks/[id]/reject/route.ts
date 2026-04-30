import { writeExecutionLog } from "@/src/lib/execution-log";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

export async function POST(_request: Request, context: RouteContext<"/api/interaction-tasks/[id]/reject">) {
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

    const task = await prisma.interactionTask.update({
      where: { id },
      data: {
        status: "CANCELLED",
        resultMessage: "已人工驳回",
      },
      include: {
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
      },
    });

    await writeExecutionLog({
      accountId: task.accountId,
      actionType: "INTERACTION_REJECTED",
      success: true,
    });

    return Response.json({ success: true, data: task, message: "互动任务已驳回" });
  } catch {
    return Response.json({ success: false, message: "驳回互动任务失败" }, { status: 500 });
  }
}
