import { InteractionsManager } from "@/components/interactions/interactions-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function InteractionsPage() {
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

  return <InteractionsManager accounts={accounts} initialTasks={tasks} />;
}
