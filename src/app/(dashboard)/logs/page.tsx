import { LogsManager } from "@/components/logs/logs-manager";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const session = await requirePageRole("VIEWER");

  const [logs, users] = await Promise.all([
    prisma.executionLog.findMany({
      where:
        session.role === "ADMIN"
          ? {}
          : {
              account: {
                ownerUserId: session.id,
              },
            },
      include: {
        account: true,
      },
      orderBy: { executedAt: "desc" },
      take: 50,
    }),
    session.role === "ADMIN"
      ? prisma.user.findMany({
          select: { id: true, username: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return <LogsManager initialLogs={logs} users={users} isAdmin={session.role === "ADMIN"} />;
}
