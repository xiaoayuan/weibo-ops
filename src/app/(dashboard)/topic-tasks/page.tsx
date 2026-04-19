import { TopicTasksManager } from "@/components/topic-tasks/topic-tasks-manager";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TopicTasksPage() {
  const session = await requirePageRole("VIEWER");

  const [tasks, accounts, topics] = await Promise.all([
    prisma.accountTopicTask.findMany({
      where: {
        account: {
          ownerUserId: session.id,
        },
      },
      include: {
        account: true,
        superTopic: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.weiboAccount.findMany({
      where: {
        ownerUserId: session.id,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.superTopic.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return <TopicTasksManager currentUserRole={session.role} initialTasks={tasks} accounts={accounts} topics={topics} />;
}
