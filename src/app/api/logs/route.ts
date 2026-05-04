import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

async function maskForeignAccounts(logs: Array<{ account: { id: string; nickname: string; ownerUserId: string } | null }>, adminUserId: string) {
  const foreignOwnerIds = new Set<string>();
  for (const log of logs) {
    if (log.account && log.account.ownerUserId !== adminUserId) {
      foreignOwnerIds.add(log.account.ownerUserId);
    }
  }
  if (foreignOwnerIds.size === 0) return logs;

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(foreignOwnerIds) } },
    select: { id: true, username: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.username]));

  for (const log of logs) {
    if (log.account && log.account.ownerUserId !== adminUserId) {
      log.account.nickname = userMap.get(log.account.ownerUserId) || log.account.ownerUserId;
    }
  }
  return logs;
}

export async function GET(request: Request) {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim() || undefined;

  const logs = await prisma.executionLog.findMany({
    where:
      auth.session.role === "ADMIN"
        ? {
            ...(userId
              ? {
                  account: {
                    ownerUserId: userId,
                  },
                }
              : {}),
          }
        : {
            account: {
              ownerUserId: auth.session.id,
            },
          },
    include: {
      account: {
        select: {
          id: true,
          nickname: true,
          status: true,
          loginStatus: true,
          ownerUserId: true,
        },
      },
      plan: true,
    },
    orderBy: { executedAt: "desc" },
    take: 50,
  });

  if (auth.session.role === "ADMIN") {
    await maskForeignAccounts(logs, auth.session.id);
  }

  return Response.json({ success: true, data: logs });
}
