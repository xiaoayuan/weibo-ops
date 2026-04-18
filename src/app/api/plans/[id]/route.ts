import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";
import { updatePlanSchema } from "@/server/validators/plan";

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
      actionType: "PLAN_STATUS_UPDATED",
      requestPayload: parsed.data,
      success: true,
    });

    return Response.json({ success: true, data: plan });
  } catch {
    return Response.json({ success: false, message: "更新计划失败" }, { status: 500 });
  }
}
