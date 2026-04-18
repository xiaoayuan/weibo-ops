import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";

export async function POST(_request: Request, context: RouteContext<"/api/interaction-tasks/[id]/reject">) {
  const { id } = await context.params;

  try {
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
