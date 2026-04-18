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

    const status = body.status as InteractionTaskStatus;

    const task = await prisma.interactionTask.update({
      where: { id },
      data: {
        status,
        resultMessage: body.resultMessage || null,
      },
      include: {
        account: true,
        target: true,
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
