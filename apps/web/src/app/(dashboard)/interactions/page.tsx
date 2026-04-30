import { InteractionsManager } from "@/components/interactions-manager";
import { getAccounts, getCopywritingTemplates, getInteractionTasks } from "@/lib/app-data";

export const dynamic = "force-dynamic";

export default async function InteractionsPage() {
  const [accounts, contents, tasks] = await Promise.all([getAccounts(), getCopywritingTemplates(), getInteractionTasks()]);

  return <InteractionsManager accounts={accounts} contents={contents} initialTasks={tasks} />;
}
