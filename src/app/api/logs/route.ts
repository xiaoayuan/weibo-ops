import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toBusinessDateTime } from "@/lib/business-date";

async function maskForeignAccounts(
  logs: Array<{ account: { id: string; nickname: string; ownerUserId: string | null; actualNickname?: string | null } | null }>,
  adminUserId: string,
) {
  const foreignOwnerIds = new Set<string>();
  for (const log of logs) {
    if (log.account?.ownerUserId && log.account.ownerUserId !== adminUserId) {
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
    if (log.account?.ownerUserId && log.account.ownerUserId !== adminUserId) {
      log.account.actualNickname = log.account.nickname;
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
  const date = searchParams.get("date")?.trim() || undefined;
  const limitParam = Number(searchParams.get("limit") || 0);
  const take = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 2000) : (date ? 1000 : 50);

  const executedAtFilter = date
    ? {
        gte: toBusinessDateTime(date, "00:00"),
        lt: toBusinessDateTime(date, "23:59"),
      }
    : undefined;

  const isAdmin = auth.session.role === "ADMIN";

  const logs = await prisma.executionLog.findMany({
    where:
      isAdmin
        ? {
            ...(userId
              ? {
                  OR: [
                    { account: { ownerUserId: userId } },
                    { userId },
                  ],
                }
              : {}),
            ...(executedAtFilter
              ? {
                  executedAt: executedAtFilter,
                }
              : {}),
          }
        : {
            ...(executedAtFilter
              ? {
                  executedAt: executedAtFilter,
                }
              : {}),
            OR: [
              { account: { ownerUserId: auth.session.id } },
              { userId: auth.session.id },
            ],
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
      plan: {
        include: {
          task: {
            include: {
              superTopic: true,
            },
          },
        },
      },
    },
    orderBy: { executedAt: "desc" },
    take,
  });

  if (isAdmin) {
    await maskForeignAccounts(logs, auth.session.id);
  }

  return Response.json({ success: true, data: logs });
}
