import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { writeExecutionLog } from "@/server/logs";
import { createInteractionBatchSchema } from "@/server/validators/interaction";

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = createInteractionBatchSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const target = await prisma.interactionTarget.create({
      data: {
        targetUrl: parsed.data.targetUrl,
        targetType: "COMMENT_LINK",
        parsedTargetId: parsed.data.targetUrl.split("/").filter(Boolean).pop() || null,
        status: "PENDING",
      },
    });

    for (const accountId of parsed.data.accountIds) {
      await prisma.interactionTask.create({
        data: {
          targetId: target.id,
          accountId,
          actionType: parsed.data.actionType,
          status: "PENDING",
        },
      });

      await writeExecutionLog({
        accountId,
        actionType: "INTERACTION_TASK_CREATED",
        requestPayload: { targetUrl: parsed.data.targetUrl, actionType: parsed.data.actionType },
        success: true,
      });
    }

    const tasks = await prisma.interactionTask.findMany({
      where: { targetId: target.id },
      include: {
        account: true,
        target: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ success: true, data: tasks });
  } catch {
    return Response.json({ success: false, message: "创建互动任务失败" }, { status: 500 });
  }
}
