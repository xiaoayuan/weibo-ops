import { UsersManager } from "@/components/users/users-manager";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requirePageRole("ADMIN");

  const [users, inviteCodes] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.inviteCode.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return <UsersManager initialUsers={users} initialInviteCodes={inviteCodes} />;
}
