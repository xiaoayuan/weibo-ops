import { AccountsManager } from "@/components/accounts/accounts-manager";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const session = await requirePageRole("VIEWER");

  const accounts = await prisma.weiboAccount.findMany({
    where: { ownerUserId: session.id },
    orderBy: { createdAt: "desc" },
  });

  return <AccountsManager currentUserRole={session.role} initialAccounts={accounts} />;
}
