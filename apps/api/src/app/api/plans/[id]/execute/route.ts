import { executePlanById } from "@/src/lib/execute-plan";
import { writeExecutionLog } from "@/src/lib/execution-log";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { scheduleTask } from "@/src/lib/task-scheduler";
import { ScheduledTaskCancelledError } from "@/src/lib/task-scheduler-types";

export async function POST(_request: Request, context: RouteContext<"/api/plans/[id]/execute">) {
  const auth = await requireApiRole("OPERATOR");
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const plan = await prisma.dailyPlan.findUnique({ where: { id }, include: { account: { select: { id: true, ownerUserId: true } } } });
    if (!plan) return Response.json({ success: false, message: "计划不存在" }, { status: 404 });
    if (plan.account.ownerUserId !== auth.session.id) return Response.json({ success: false, message: "计划不存在" }, { status: 404 });

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
      requestPayload: { planId: id, ownerUserId: auth.session.id, workerId: scheduled.workerId, userConcurrency: scheduled.userConcurrency, queueDepth: scheduled.queueDepth },
      success: true,
    });

    const result = scheduled.data;
    if (!result.ok) {
      return Response.json({ success: false, message: result.message, workerId: scheduled.workerId, userConcurrency: scheduled.userConcurrency, queueDepth: scheduled.queueDepth }, { status: result.status });
    }

    return Response.json({ success: result.success, data: result.data, message: result.message, workerId: scheduled.workerId, userConcurrency: scheduled.userConcurrency, queueDepth: scheduled.queueDepth });
  } catch (error) {
    if (error instanceof ScheduledTaskCancelledError) {
      const plan = await prisma.dailyPlan.findUnique({
        where: { id },
        include: {
          account: { select: { id: true, nickname: true, status: true, loginStatus: true, ownerUserId: true } },
          content: true,
          task: { include: { superTopic: true } },
        },
      });

      return Response.json({ success: false, data: plan, message: plan?.resultMessage || "计划已停止" });
    }

    return Response.json({ success: false, message: "执行计划失败" }, { status: 500 });
  }
}
