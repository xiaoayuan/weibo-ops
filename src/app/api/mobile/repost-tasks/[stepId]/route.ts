import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { recomputeRepostJobSummary, recomputeRepostRunStatus } from "@/server/action-jobs/runner";
import { writeExecutionLog } from "@/server/logs";

export async function POST(request: Request, context: RouteContext<"/api/mobile/repost-tasks/[stepId]">) {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const { stepId } = await context.params;

  try {
    const body = (await request.json()) as { outcome?: "SUCCESS" | "FAILED"; message?: string };

    if (body.outcome !== "SUCCESS" && body.outcome !== "FAILED") {
      return Response.json({ success: false, message: "执行结果无效" }, { status: 400 });
    }

    const step = await prisma.actionJobStep.findUnique({
      where: { id: stepId },
      include: {
        account: {
          select: {
            id: true,
            ownerUserId: true,
            nickname: true,
          },
        },
        job: {
          select: {
            id: true,
            status: true,
            createdBy: true,
            config: true,
          },
        },
      },
    });

    if (!step || step.account.ownerUserId !== auth.session.id || step.job.createdBy !== auth.session.id) {
      return Response.json({ success: false, message: "任务不存在" }, { status: 404 });
    }

    const config = step.job.config as { executionMode?: string; targetUrl?: string; times?: number; intervalSec?: 0 | 3 | 5 | 10 } | null;

    if (config?.executionMode !== "MOBILE_ASSISTED") {
      return Response.json({ success: false, message: "该任务不是手机执行模式" }, { status: 400 });
    }

    if (step.status === "CANCELLED" || step.job.status === "CANCELLED") {
      return Response.json({ success: false, message: "该任务已停止" }, { status: 400 });
    }

    const updatedStep = await prisma.actionJobStep.update({
      where: { id: stepId },
      data: {
        status: body.outcome,
        errorMessage: body.outcome === "FAILED" ? body.message || "手机端标记失败" : null,
        resultPayload: {
          source: "MOBILE_ASSISTED",
          outcome: body.outcome,
          message: body.message || null,
          reportedBy: auth.session.username,
        },
        startedAt: step.startedAt || new Date(),
        finishedAt: new Date(),
      },
    });

    await recomputeRepostRunStatus(step.job.id, step.account.id);
    await recomputeRepostJobSummary(step.job.id, config?.targetUrl || step.targetUrl, config?.times || 1, config?.intervalSec || 3);

    await writeExecutionLog({
      accountId: step.account.id,
      actionType: body.outcome === "SUCCESS" ? "ACTION_JOB_STEP_SUCCESS" : "ACTION_JOB_STEP_FAILED",
      requestPayload: {
        jobId: step.job.id,
        stepId: step.id,
        stepType: "REPOST",
        targetUrl: step.targetUrl,
        sequenceNo: step.sequenceNo,
        source: "MOBILE_ASSISTED",
      },
      responsePayload: updatedStep.resultPayload,
      success: body.outcome === "SUCCESS",
      errorMessage: body.outcome === "SUCCESS" ? undefined : body.message || "手机端标记失败",
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false, message: "回写手机执行结果失败" }, { status: 500 });
  }
}
