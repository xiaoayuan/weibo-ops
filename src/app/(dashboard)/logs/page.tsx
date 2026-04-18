import { LogsManager } from "@/components/logs/logs-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const logs = await prisma.executionLog.findMany({
    include: {
      account: true,
    },
    orderBy: { executedAt: "desc" },
    take: 30,
  });

  return <LogsManager initialLogs={logs} />;
}
