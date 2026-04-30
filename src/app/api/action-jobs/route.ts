import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

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

  const visibleJobs = jobs
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
          nickname: run.account.ownerUserId === auth.session.id ? run.account.nickname : "其他用户账号",
        },
      })),
    }));

  return Response.json({ success: true, data: visibleJobs });
}
