import { OpsManager } from "@/components/ops-manager";
import { getAccounts, getActionJobs, getCommentPoolItems } from "@/lib/app-data";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const session = await requireSession();

  const [allAccounts, poolItems, jobs] = await Promise.all([getAccounts(), getCommentPoolItems(), getActionJobs()]);

  const accounts = allAccounts.filter((a) => a.ownerUserId === session.id);

  return <OpsManager accounts={accounts} initialPoolItems={poolItems} initialJobs={jobs} />;
}
