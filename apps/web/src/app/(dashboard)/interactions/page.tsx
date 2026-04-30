import { InteractionsManager } from "@/components/interactions-manager";
import { getAccounts, getCopywritingTemplates, getInteractionTasks } from "@/lib/app-data";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InteractionsPage() {
  await requireSession();

  const [accounts, contents, tasks] = await Promise.all([getAccounts(), getCopywritingTemplates(), getInteractionTasks()]);

  return <InteractionsManager accounts={accounts} contents={contents} initialTasks={tasks} />;
}
