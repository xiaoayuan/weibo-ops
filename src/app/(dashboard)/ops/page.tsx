import { OpsManager } from "@/components/ops/ops-manager";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getExecutionStrategy } from "@/server/strategy/config";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const session = await requirePageRole("VIEWER");

  const [accounts, poolItems, rawJobs, executionStrategy] = await Promise.all([
    prisma.weiboAccount.findMany({
      where: {
        status: "ACTIVE",
        ownerUserId: session.id,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.commentLinkPoolItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.actionJob.findMany({
      include: {
        accountRuns: {
          include: {
            account: {
              select: { id: true, nickname: true, ownerUserId: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    getExecutionStrategy(),
  ]);

  const jobs = rawJobs
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

  return <OpsManager accounts={accounts} currentUserRole={session.role} initialJobs={jobs} initialPoolItems={poolItems} initialStrategy={executionStrategy} />;
}
