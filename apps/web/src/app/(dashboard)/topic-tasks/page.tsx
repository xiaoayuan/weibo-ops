import { TopicTasksManager } from "@/components/topic-tasks-manager";
import { getAccounts, getSuperTopics, getTopicTasks } from "@/lib/app-data";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TopicTasksPage() {
  await requireSession();

  const [tasks, accounts, topics] = await Promise.all([getTopicTasks(), getAccounts(), getSuperTopics()]);

  return <TopicTasksManager initialTasks={tasks} accounts={accounts} topics={topics} />;
}
