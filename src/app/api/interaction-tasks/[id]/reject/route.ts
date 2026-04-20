import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { writeExecutionLog } from "@/server/logs";

export async function POST(_request: Request, context: RouteContext<"/api/interaction-tasks/[id]/reject">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const existing = await prisma.interactionTask.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return Response.json({ success: false, message: "互动任务不存在" }, { status: 404 });
    }

    const task = await prisma.interactionTask.update({
      where: { id },
      data: {
        status: "CANCELLED",
        resultMessage: "已人工驳回",
      },
      include: {
        account: true,
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
