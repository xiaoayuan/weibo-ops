import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";
import { cancelTask } from "@/server/task-scheduler";

const planInclude = {
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

    const cancelled = await cancelTask({
      kind: "PLAN",
      id,
      ownerUserId: auth.session.id,
    });

    if (cancelled.removed > 0) {
      const plan = await prisma.dailyPlan.update({
        where: { id },
        data: {
          status: "CANCELLED",
          resultMessage: "已停止（队列中移除）",
        },
        include: planInclude,
      });

      await writeExecutionLog({
        accountId: plan.accountId,
        planId: plan.id,
        actionType: "PLAN_STOPPED",
        success: true,
      });

      return Response.json({ success: true, data: plan, message: "计划已停止" });
    }

    if (existing.status === "RUNNING") {
      const plan = await prisma.dailyPlan.update({
        where: { id },
        data: {
          resultMessage: "已请求停止；若当前动作已发出，仍可能继续完成",
        },
        include: planInclude,
      });

      await writeExecutionLog({
        accountId: plan.accountId,
        planId: plan.id,
        actionType: "PLAN_STOPPED",
        success: true,
        errorMessage: "运行中计划仅记录停止请求，当前动作可能继续完成",
      });

      return Response.json({
        success: true,
        data: plan,
        message: "已记录停止请求；若当前动作已发出，仍可能继续完成",
      });
    }

    const currentPlan = await prisma.dailyPlan.findUnique({ where: { id }, include: planInclude });

    if (!currentPlan) {
      return Response.json({ success: false, message: "计划不存在" }, { status: 404 });
    }

    return Response.json({ success: true, data: currentPlan, message: currentPlan.resultMessage || "计划状态未变化" });
  } catch {
    return Response.json({ success: false, message: "停止计划失败" }, { status: 500 });
  }
}
