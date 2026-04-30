import { writeExecutionLog } from "@/src/lib/execution-log";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { updatePlanSchema } from "@/src/lib/validators";

export async function PATCH(request: Request, context: RouteContext<"/api/plans/[id]">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = updatePlanSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

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
        status: parsed.data.status,
        resultMessage: parsed.data.resultMessage || null,
        scheduledTime: parsed.data.scheduledTime ? new Date(parsed.data.scheduledTime) : undefined,
        contentId:
          parsed.data.contentId === undefined
            ? undefined
            : parsed.data.contentId === null || parsed.data.contentId === ""
              ? null
              : parsed.data.contentId,
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
      actionType: "PLAN_STATUS_UPDATED",
      requestPayload: parsed.data,
      success: true,
    });

    return Response.json({ success: true, data: plan });
  } catch {
    return Response.json({ success: false, message: "更新计划失败" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/plans/[id]">) {
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

    const plan = await prisma.dailyPlan.delete({
      where: { id },
      select: {
        id: true,
        accountId: true,
      },
    });

    await writeExecutionLog({
      accountId: plan.accountId,
      planId: plan.id,
      actionType: "PLAN_DELETED",
      requestPayload: { id: plan.id },
      success: true,
    });

    return Response.json({ success: true, message: "删除成功" });
  } catch {
    return Response.json({ success: false, message: "删除计划失败" }, { status: 500 });
  }
}
