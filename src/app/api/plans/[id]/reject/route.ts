import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { writeExecutionLog } from "@/server/logs";

export async function POST(_request: Request, context: RouteContext<"/api/plans/[id]/reject">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const plan = await prisma.dailyPlan.update({
      where: { id },
      data: {
        status: "CANCELLED",
        resultMessage: "已人工驳回",
      },
      include: {
        account: true,
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
      actionType: "PLAN_REJECTED",
      success: true,
    });

    return Response.json({ success: true, data: plan, message: "计划已驳回" });
  } catch {
    return Response.json({ success: false, message: "驳回计划失败" }, { status: 500 });
  }
}
