import { InteractionsManager } from "@/components/interactions/interactions-manager";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function InteractionsPage() {
  const session = await requirePageRole("VIEWER");

  const [accounts, tasks] = await Promise.all([
    prisma.weiboAccount.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.interactionTask.findMany({
      include: {
        account: true,
        target: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return <InteractionsManager accounts={accounts} currentUserRole={session.role} initialTasks={tasks} />;
}
