import { AccountsManager } from "@/components/accounts-manager";
import { getAccounts } from "@/lib/app-data";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await getAccounts();

  return <AccountsManager initialAccounts={accounts} />;
}
