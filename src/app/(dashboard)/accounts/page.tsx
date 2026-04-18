import { AccountsManager } from "@/components/accounts/accounts-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await prisma.weiboAccount.findMany({
    orderBy: { createdAt: "desc" },
  });

  return <AccountsManager initialAccounts={accounts} />;
}
