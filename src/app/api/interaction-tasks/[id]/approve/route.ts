import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";

export async function POST(_request: Request, context: RouteContext<"/api/interaction-tasks/[id]/approve">) {
  const { id } = await context.params;

  try {
    const task = await prisma.interactionTask.update({
      where: { id },
      data: {
        status: "READY",
        resultMessage: "已人工确认，可进入执行阶段",
      },
      include: {
        account: true,
        target: true,
      },
    });

    await writeExecutionLog({
      accountId: task.accountId,
      actionType: "INTERACTION_APPROVED",
      success: true,
    });

    return Response.json({ success: true, data: task, message: "互动任务已人工确认" });
  } catch {
    return Response.json({ success: false, message: "确认互动任务失败" }, { status: 500 });
  }
}
