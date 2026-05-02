import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

export async function DELETE(_request: Request, context: RouteContext<"/api/action-jobs/[id]">) {
  const auth = await requireApiRole("OPERATOR");
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const existing = await prisma.actionJob.findUnique({
      where: { id },
      select: { id: true, createdBy: true, status: true },
    });

    if (!existing || (existing.createdBy !== auth.session.id && auth.session.role !== "ADMIN")) {
      return Response.json({ success: false, message: "任务不存在" }, { status: 404 });
    }

    if (existing.status === "RUNNING" || existing.status === "PENDING") {
      return Response.json({ success: false, message: "请先停止批次，再执行删除" }, { status: 400 });
    }

    await prisma.actionJob.delete({ where: { id } });
    return Response.json({ success: true, message: "批次已删除" });
  } catch {
    return Response.json({ success: false, message: "删除批次失败" }, { status: 500 });
  }
}
