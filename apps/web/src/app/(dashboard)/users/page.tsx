import { UsersManager } from "@/components/users-manager";
import { getInviteCodes, getUsers } from "@/lib/app-data";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireRole("ADMIN");

  const [users, inviteCodes] = await Promise.all([getUsers(), getInviteCodes()]);

  return <UsersManager initialUsers={users} initialInviteCodes={inviteCodes} />;
}
