import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";
import { executePlanById } from "@/server/plans/execute-plan";
import { scheduleTaskDetached } from "@/server/task-scheduler";
import { ScheduledTaskCancelledError } from "@/server/task-scheduler/types";

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

export async function POST(_request: Request, context: RouteContext<"/api/plans/[id]/execute">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const plan = await prisma.dailyPlan.findUnique({
      where: { id },
      include: { account: { select: { id: true, ownerUserId: true } } },
    });

    if (!plan) {
      return Response.json({ success: false, message: "计划不存在" }, { status: 404 });
    }

    if (plan.account.ownerUserId !== auth.session.id) {
      return Response.json({ success: false, message: "计划不存在" }, { status: 404 });
    }

    const scheduled = await scheduleTaskDetached({
      kind: "PLAN",
      id,
      ownerUserId: auth.session.id,
      label: `plan:${id}`,
      run: () => executePlanById(id, auth.session.id),
    });

    const queuedPlan = await prisma.dailyPlan.update({
      where: { id },
      data: {
        status: "READY",
        resultMessage: "手动执行已入队",
      },
      include: planInclude,
    });

    await writeExecutionLog({
      accountId: plan.account.id,
      planId: id,
      actionType: "PLAN_SCHEDULED",
      requestPayload: {
        planId: id,
        ownerUserId: auth.session.id,
        workerId: scheduled.workerId,
        userConcurrency: scheduled.userConcurrency,
        queueDepth: scheduled.queueDepth,
        trigger: "MANUAL_EXECUTE",
      },
      success: true,
    });

    return Response.json({
      success: true,
      data: queuedPlan,
      message: "计划已入队，正在等待执行",
      workerId: scheduled.workerId,
      userConcurrency: scheduled.userConcurrency,
      queueDepth: scheduled.queueDepth,
    });
  } catch (error) {
    if (error instanceof ScheduledTaskCancelledError) {
      const plan = await prisma.dailyPlan.findUnique({ where: { id }, include: planInclude });

      return Response.json({ success: false, data: plan, message: plan?.resultMessage || "计划已停止" });
    }

    return Response.json({ success: false, message: "执行计划失败" }, { status: 500 });
  }
}
