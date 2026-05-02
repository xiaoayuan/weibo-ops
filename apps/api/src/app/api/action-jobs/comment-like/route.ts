import { assignActionJobNode } from "@/src/lib/action-job-nodes";
import { writeExecutionLog } from "@/src/lib/execution-log";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { reserveRateLimitedExecution } from "@/src/lib/rate-limit";
import { startCommentLikeJobSchema } from "@/src/lib/validators";

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = startCommentLikeJobSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const poolItems = await prisma.commentLinkPoolItem.findMany({
      where: {
        id: { in: parsed.data.poolItemIds },
      },
      select: {
        id: true,
        sourceUrl: true,
      },
      orderBy: { createdAt: "desc" },
    });
    type PoolItem = (typeof poolItems)[number];

    if (poolItems.length === 0) {
      return Response.json({ success: false, message: "未找到可执行的控评链接" }, { status: 400 });
    }

    const availableAccounts = await prisma.weiboAccount.findMany({
      where: {
        id: {
          in: parsed.data.accountIds,
        },
        ownerUserId: auth.session.id,
      },
      select: {
        id: true,
      },
    });

    if (availableAccounts.length !== parsed.data.accountIds.length) {
      return Response.json({ success: false, message: "包含无权限账号" }, { status: 403 });
    }

    const targetNodeId = await assignActionJobNode(parsed.data.targetNodeId);
    const scheduleDecision = await reserveRateLimitedExecution({
      ownerUserId: auth.session.id,
      taskType: "COMMENT_CONTROL",
      baseTier: parsed.data.urgency || "S",
    });
    const earliestStartAt = new Date(Date.now() + scheduleDecision.delayMs).toISOString();

    const job = await prisma.actionJob.create({
      data: {
        jobType: "COMMENT_LIKE_BATCH",
        status: "PENDING",
        config: {
          accountIds: parsed.data.accountIds,
          poolItemIds: poolItems.map((item: PoolItem) => item.id),
          targetNodeId,
          urgency: scheduleDecision.effectiveTier,
          earliestStartAt,
          scheduleDecision,
          forecast: parsed.data.forecast,
          aiRisk: parsed.data.aiRisk,
        },
        createdBy: auth.session.id,
      },
    });

    await prisma.actionJobAccountRun.createMany({
      data: parsed.data.accountIds.map((accountId) => ({
        jobId: job.id,
        accountId,
        totalSteps: poolItems.length,
        status: "PENDING" as const,
      })),
      skipDuplicates: true,
    });

    await prisma.actionJobStep.createMany({
      data: parsed.data.accountIds.flatMap((accountId: string) =>
        poolItems.map((item: PoolItem, index: number) => ({
          jobId: job.id,
          accountId,
          stepType: "COMMENT_LIKE" as const,
          targetUrl: item.sourceUrl,
          payload: { poolItemId: item.id },
          sequenceNo: index + 1,
        })),
      ),
    });

    await writeExecutionLog({
      actionType: "ACTION_JOB_SCHEDULED",
      requestPayload: {
        jobId: job.id,
        jobType: "COMMENT_LIKE_BATCH",
        ownerUserId: auth.session.id,
        targetNodeId,
        earliestStartAt,
        scheduleDecision,
        queueState: scheduleDecision.delayMs > 0 ? "DELAYED" : "QUEUED",
        aiRisk: parsed.data.aiRisk,
      },
      success: true,
    });

    const finalJob = await prisma.actionJob.findUnique({
      where: { id: job.id },
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

    return Response.json({ success: true, data: finalJob, workerId: targetNodeId });
  } catch {
    return Response.json({ success: false, message: "创建控评点赞任务失败" }, { status: 500 });
  }
}
