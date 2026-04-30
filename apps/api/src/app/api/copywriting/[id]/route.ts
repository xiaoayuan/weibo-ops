import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { createCopywritingSchema } from "@/src/lib/validators";

export async function PATCH(request: Request, context: RouteContext<"/api/copywriting/[id]">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = createCopywritingSchema.partial().safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const item = await prisma.copywritingTemplate.update({
      where: { id },
      data: parsed.data,
    });

    return Response.json({ success: true, data: item });
  } catch {
    return Response.json({ success: false, message: "更新文案失败" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/copywriting/[id]">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    await prisma.copywritingTemplate.delete({ where: { id } });
    return Response.json({ success: true, message: "删除成功" });
  } catch {
    return Response.json({ success: false, message: "删除文案失败" }, { status: 500 });
  }
}
