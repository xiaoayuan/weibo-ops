import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const logs = await prisma.executionLog.findMany({
    where: {
      account: {
        ownerUserId: auth.session.id,
      },
    },
    include: {
      account: true,
      plan: true,
    },
    orderBy: { executedAt: "desc" },
    take: 50,
  });

  return Response.json({ success: true, data: logs });
}
