import { prisma } from "@/src/lib/prisma";
import type { SessionUser } from "@/src/lib/auth";

export type PaginationParams = {
  page?: number;
  pageSize?: number;
};

export type PaginatedResult<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export async function listVisibleExecutionLogs(
  session: SessionUser,
  userId?: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<Awaited<ReturnType<typeof prisma.executionLog.findMany>>[0]>> {
  const page = pagination?.page || 1;
  const pageSize = Math.min(pagination?.pageSize || 50, 100);
  const skip = (page - 1) * pageSize;

  const where =
    session.role === "ADMIN"
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
            ownerUserId: session.id,
          },
        };

  const [data, total] = await Promise.all([
    prisma.executionLog.findMany({
      where,
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
      skip,
      take: pageSize,
    }),
    prisma.executionLog.count({ where }),
  ]);

  // ADMIN 查看时，将非本人的微博账号 nickname 替换为所属用户名，防止信息泄露
  if (session.role === "ADMIN" && data.length > 0) {
    const foreignOwnerIds = new Set<string>();
    for (const log of data) {
      if (log.account?.ownerUserId && log.account.ownerUserId !== session.id) {
        foreignOwnerIds.add(log.account.ownerUserId);
      }
    }
    if (foreignOwnerIds.size > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: Array.from(foreignOwnerIds) } },
        select: { id: true, username: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u.username]));
      for (const log of data) {
        if (log.account?.ownerUserId && log.account.ownerUserId !== session.id) {
          log.account.nickname = userMap.get(log.account.ownerUserId) || log.account.ownerUserId;
        }
      }
    }
  }

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
