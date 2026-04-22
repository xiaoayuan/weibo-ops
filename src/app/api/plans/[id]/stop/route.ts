import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";
import { cancelTask } from "@/server/task-scheduler";

const planInclude = {
  account: true,
  content: true,
  task: {
    include: {
      superTopic: true,
    },
  },
} as const;

export async function POST(_request: Request, context: RouteContext<"/api/plans/[id]/stop">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const existing = await prisma.dailyPlan.findUnique({
      where: { id },
      include: {
        account: {
          select: {
            id: true,
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
        status: "CANCELLED",
        resultMessage: "已人工停止",
      },
      include: planInclude,
    });

    await cancelTask({
      kind: "PLAN",
      id,
      ownerUserId: auth.session.id,
    });

    await writeExecutionLog({
      accountId: plan.accountId,
      planId: plan.id,
      actionType: "PLAN_STOPPED",
      success: true,
    });

    return Response.json({ success: true, data: plan, message: "计划已停止" });
  } catch {
    return Response.json({ success: false, message: "停止计划失败" }, { status: 500 });
  }
}
