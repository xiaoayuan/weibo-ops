import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

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

  return Response.json({ success: true, data: logs });
}
