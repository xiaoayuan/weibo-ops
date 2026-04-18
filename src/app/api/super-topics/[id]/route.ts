import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { createSuperTopicSchema } from "@/server/validators/super-topic";

export async function PATCH(request: Request, context: RouteContext<"/api/super-topics/[id]">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = createSuperTopicSchema.partial().safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const topic = await prisma.superTopic.update({
      where: { id },
      data: {
        name: parsed.data.name,
        boardName: parsed.data.boardName === "" ? null : parsed.data.boardName,
        topicUrl: parsed.data.topicUrl === "" ? null : parsed.data.topicUrl,
      },
    });

    return Response.json({ success: true, data: topic });
  } catch {
    return Response.json({ success: false, message: "更新超话失败" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/super-topics/[id]">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    await prisma.superTopic.delete({ where: { id } });
    return Response.json({ success: true, message: "删除成功" });
  } catch {
    return Response.json({ success: false, message: "删除超话失败" }, { status: 500 });
  }
}
