import { TopicTasksManager } from "@/components/topic-tasks/topic-tasks-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TopicTasksPage() {
  const [tasks, accounts, topics] = await Promise.all([
    prisma.accountTopicTask.findMany({
      include: {
        account: true,
        superTopic: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.weiboAccount.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.superTopic.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return <TopicTasksManager initialTasks={tasks} accounts={accounts} topics={topics} />;
}
