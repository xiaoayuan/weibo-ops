import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { runRepostRotationJob } from "@/server/action-jobs/runner";
import { startRepostRotationJobSchema } from "@/server/validators/ops";

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = startRepostRotationJobSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
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

    const job = await prisma.actionJob.create({
      data: {
        jobType: "REPOST_ROTATION",
        status: "RUNNING",
        config: {
          accountIds: parsed.data.accountIds,
          targetUrl: parsed.data.targetUrl,
          times: parsed.data.times,
          intervalSec: parsed.data.intervalSec,
          copywritingTexts: parsed.data.copywritingTexts || [],
        },
        createdBy: auth.session.id,
      },
    });

    const fallbackTexts = ["1", "2", "3", "4", "5"];
    const copywritingTexts =
      parsed.data.copywritingTexts && parsed.data.copywritingTexts.length > 0 ? parsed.data.copywritingTexts : fallbackTexts;

    const runData = parsed.data.accountIds.map((accountId) => ({
      jobId: job.id,
      accountId,
      totalSteps: parsed.data.times,
      status: "PENDING" as const,
    }));

    await prisma.actionJobAccountRun.createMany({
      data: runData,
      skipDuplicates: true,
    });

    const stepData = parsed.data.accountIds.flatMap((accountId) =>
      Array.from({ length: parsed.data.times }).map((_, index) => ({
        jobId: job.id,
        accountId,
        stepType: "REPOST" as const,
        targetUrl: parsed.data.targetUrl,
        payload: { repostContent: copywritingTexts[index % copywritingTexts.length] },
        sequenceNo: index + 1,
      })),
    );

    await prisma.actionJobStep.createMany({ data: stepData });
    await runRepostRotationJob({
      jobId: job.id,
      accountIds: parsed.data.accountIds,
      targetUrl: parsed.data.targetUrl,
      times: parsed.data.times,
      intervalSec: parsed.data.intervalSec,
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

    return Response.json({ success: true, data: finalJob });
  } catch {
    return Response.json({ success: false, message: "创建轮转转发任务失败" }, { status: 500 });
  }
}
