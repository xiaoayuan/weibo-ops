import { prisma } from "@/lib/prisma";
import { updateTopicTaskSchema } from "@/server/validators/topic-task";

export async function PATCH(request: Request, context: RouteContext<"/api/topic-tasks/[id]">) {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = updateTopicTaskSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const task = await prisma.accountTopicTask.update({
      where: { id },
      data: {
        accountId: parsed.data.accountId,
        superTopicId: parsed.data.superTopicId,
        signEnabled: parsed.data.signEnabled,
        postEnabled: parsed.data.postEnabled,
        minPostsPerDay: parsed.data.minPostsPerDay,
        maxPostsPerDay: parsed.data.maxPostsPerDay,
        startTime: parsed.data.startTime === "" ? null : parsed.data.startTime,
        endTime: parsed.data.endTime === "" ? null : parsed.data.endTime,
        status: parsed.data.status,
      },
      include: {
        account: true,
        superTopic: true,
      },
    });

    return Response.json({ success: true, data: task });
  } catch {
    return Response.json({ success: false, message: "更新任务失败" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/topic-tasks/[id]">) {
  const { id } = await context.params;

  try {
    await prisma.accountTopicTask.delete({ where: { id } });
    return Response.json({ success: true, message: "删除成功" });
  } catch {
    return Response.json({ success: false, message: "删除任务失败" }, { status: 500 });
  }
}
