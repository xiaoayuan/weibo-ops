import { OpsManager } from "@/components/ops/ops-manager";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const session = await requirePageRole("VIEWER");

  const [accounts, poolItems, jobs] = await Promise.all([
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
      where: {
        accountRuns: {
          some: {
            account: {
              ownerUserId: session.id,
            },
          },
        },
      },
      include: {
        accountRuns: {
          where: {
            account: {
              ownerUserId: session.id,
            },
          },
          include: {
            account: {
              select: { id: true, nickname: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  return <OpsManager accounts={accounts} currentUserRole={session.role} initialJobs={jobs} initialPoolItems={poolItems} />;
}
