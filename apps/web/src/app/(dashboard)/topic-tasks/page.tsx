import { TopicTasksManager } from "@/components/topic-tasks-manager";
import { getAccounts, getSuperTopics, getTopicTasks } from "@/lib/app-data";

export const dynamic = "force-dynamic";

export default async function TopicTasksPage() {
  const [tasks, accounts, topics] = await Promise.all([getTopicTasks(), getAccounts(), getSuperTopics()]);

  return <TopicTasksManager initialTasks={tasks} accounts={accounts} topics={topics} />;
}
