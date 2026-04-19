import { LogsManager } from "@/components/logs/logs-manager";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const session = await requirePageRole("VIEWER");

  const logs = await prisma.executionLog.findMany({
    where: {
      account: {
        ownerUserId: session.id,
      },
    },
    include: {
      account: true,
    },
    orderBy: { executedAt: "desc" },
    take: 30,
  });

  return <LogsManager initialLogs={logs} />;
}
