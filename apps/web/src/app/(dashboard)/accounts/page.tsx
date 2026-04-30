import { AccountsManager } from "@/components/accounts-manager";
import { getAccounts } from "@/lib/app-data";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  await requireSession();

  const accounts = await getAccounts();

  return <AccountsManager initialAccounts={accounts} />;
}
