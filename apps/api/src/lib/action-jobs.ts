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
  type JobRow = (typeof jobs)[number];

  return jobs
    .filter((job: JobRow) => {
      const config = job.config as { executionMode?: string } | null;
      return config?.executionMode !== "MOBILE_ASSISTED";
    })
    .map((job: JobRow) => ({
      ...job,
      accountRuns: job.accountRuns.map((run: JobRow["accountRuns"][number]) => ({
        ...run,
        account: {
          id: run.account.id,
          nickname: run.account.ownerUserId === session.id ? run.account.nickname : "其他用户账号",
        },
      })),
    }));
}
