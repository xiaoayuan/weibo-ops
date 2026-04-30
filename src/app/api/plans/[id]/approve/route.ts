import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { writeExecutionLog } from "@/server/logs";

export async function POST(_request: Request, context: RouteContext<"/api/plans/[id]/approve">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const existing = await prisma.dailyPlan.findUnique({
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
      return Response.json({ success: false, message: "计划不存在" }, { status: 404 });
    }

    const plan = await prisma.dailyPlan.update({
      where: { id },
      data: {
        status: "READY",
        resultMessage: "已人工确认，可进入执行阶段",
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
        content: true,
        task: {
          include: {
            superTopic: true,
          },
        },
      },
    });

    await writeExecutionLog({
      accountId: plan.accountId,
      planId: plan.id,
      actionType: "PLAN_APPROVED",
      success: true,
    });

    return Response.json({ success: true, data: plan, message: "计划已人工确认" });
  } catch {
    return Response.json({ success: false, message: "确认计划失败" }, { status: 500 });
  }
}
