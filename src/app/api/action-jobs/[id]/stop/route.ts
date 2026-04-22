import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";
import { cancelTask } from "@/server/task-scheduler";

async function loadJob(id: string) {
  return prisma.actionJob.findUnique({
    where: { id },
    include: {
      accountRuns: {
        include: {
          account: {
            select: {
              id: true,
              nickname: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function POST(_request: Request, context: RouteContext<"/api/action-jobs/[id]/stop">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const existing = await prisma.actionJob.findUnique({
      where: { id },
      select: {
        id: true,
        createdBy: true,
      },
    });

    if (!existing || (existing.createdBy !== auth.session.id && auth.session.role !== "ADMIN")) {
      return Response.json({ success: false, message: "任务不存在" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.actionJob.update({
        where: { id },
        data: {
          status: "CANCELLED",
          summary: {
            stoppedBy: auth.session.username,
            stoppedAt: new Date().toISOString(),
          },
        },
      });

      await tx.actionJobAccountRun.updateMany({
        where: {
          jobId: id,
          status: {
            in: ["PENDING", "RUNNING", "PARTIAL_FAILED"],
          },
        },
        data: {
          status: "CANCELLED",
          errorMessage: "已人工停止",
        },
      });

      await tx.actionJobStep.updateMany({
        where: {
          jobId: id,
          status: {
            in: ["PENDING", "RUNNING"],
          },
        },
        data: {
          status: "CANCELLED",
          errorMessage: "已人工停止",
          finishedAt: new Date(),
        },
      });
    });

    if (existing.createdBy) {
      await cancelTask({
        kind: "ACTION_JOB",
        id,
        ownerUserId: existing.createdBy,
      });
    }

    await writeExecutionLog({
      actionType: "ACTION_JOB_STOPPED",
      requestPayload: {
        jobId: id,
        stoppedBy: auth.session.username,
      },
      success: true,
    });

    const job = await loadJob(id);
    return Response.json({ success: true, data: job, message: "批量任务已停止" });
  } catch {
    return Response.json({ success: false, message: "停止批量任务失败" }, { status: 500 });
  }
}
