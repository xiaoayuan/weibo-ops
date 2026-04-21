import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";
import { executePlanById } from "@/server/plans/execute-plan";
import { scheduleTask } from "@/server/task-scheduler";

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

    const scheduled = await scheduleTask({
      kind: "PLAN",
      id,
      ownerUserId: auth.session.id,
      label: `plan:${id}`,
      run: () => executePlanById(id, auth.session.id),
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
      },
      success: true,
    });

    const result = scheduled.data;

    if (!result.ok) {
      return Response.json({
        success: false,
        message: result.message,
        workerId: scheduled.workerId,
        userConcurrency: scheduled.userConcurrency,
        queueDepth: scheduled.queueDepth,
      }, { status: result.status });
    }

    return Response.json({
      success: result.success,
      data: result.data,
      message: result.message,
      workerId: scheduled.workerId,
      userConcurrency: scheduled.userConcurrency,
      queueDepth: scheduled.queueDepth,
    });
  } catch {
    return Response.json({ success: false, message: "执行计划失败" }, { status: 500 });
  }
}
