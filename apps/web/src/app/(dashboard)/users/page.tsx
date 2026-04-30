import { UsersManager } from "@/components/users-manager";
import { getInviteCodes, getUsers } from "@/lib/app-data";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [users, inviteCodes] = await Promise.all([getUsers(), getInviteCodes()]);

  return <UsersManager initialUsers={users} initialInviteCodes={inviteCodes} />;
}
