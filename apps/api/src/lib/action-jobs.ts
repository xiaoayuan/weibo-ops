import { prisma } from "@/src/lib/prisma";
import type { SessionUser } from "@/src/lib/auth";

export async function listVisibleActionJobs(session: SessionUser) {
  const jobs = await prisma.actionJob.findMany({
    include: {
      accountRuns: {
        include: {
          account: {
            select: {
              id: true,
              nickname: true,
              ownerUserId: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return jobs
    .filter((job) => {
      const config = job.config as { executionMode?: string } | null;
      return config?.executionMode !== "MOBILE_ASSISTED";
    })
    .map((job) => ({
      ...job,
      accountRuns: job.accountRuns.map((run) => ({
        ...run,
        account: {
          id: run.account.id,
          nickname: run.account.ownerUserId === session.id ? run.account.nickname : "其他用户账号",
        },
      })),
    }));
}
