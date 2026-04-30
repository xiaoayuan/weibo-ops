import { prisma } from "@/src/lib/prisma";
import type { SessionUser } from "@/src/lib/auth";

export async function listVisibleExecutionLogs(session: SessionUser, userId?: string) {
  return prisma.executionLog.findMany({
    where:
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
          },
    include: {
      account: true,
      plan: true,
    },
    orderBy: { executedAt: "desc" },
    take: 50,
  });
}
