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
  const pageSize = Math.min(pagination?.pageSize || 50, 100); // 最大 100 条
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
