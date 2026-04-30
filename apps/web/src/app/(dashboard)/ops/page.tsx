import { OpsManager } from "@/components/ops-manager";
import { getAccounts, getActionJobs, getCommentPoolItems } from "@/lib/app-data";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const [accounts, poolItems, jobs] = await Promise.all([getAccounts(), getCommentPoolItems(), getActionJobs()]);

  return <OpsManager accounts={accounts} initialPoolItems={poolItems} initialJobs={jobs} />;
}
