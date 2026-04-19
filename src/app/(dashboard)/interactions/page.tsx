import { InteractionsManager } from "@/components/interactions/interactions-manager";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function InteractionsPage() {
  const session = await requirePageRole("VIEWER");

  const [accounts, rawTasks] = await Promise.all([
    prisma.weiboAccount.findMany({
      where: {
        status: "ACTIVE",
        ownerUserId: session.id,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.interactionTask.findMany({
      include: {
        account: {
          select: {
            id: true,
            nickname: true,
            ownerUserId: true,
          },
        },
        target: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const tasks = rawTasks.map((task) => ({
    ...task,
    isOwned: task.account.ownerUserId === session.id,
    account: {
      id: task.account.id,
      nickname: task.account.ownerUserId === session.id ? task.account.nickname : "其他用户账号",
    },
  }));

  return <InteractionsManager accounts={accounts} currentUserRole={session.role} initialTasks={tasks} />;
}
