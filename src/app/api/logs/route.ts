import { prisma } from "@/lib/prisma";

export async function GET() {
  const logs = await prisma.executionLog.findMany({
    include: {
      account: true,
      plan: true,
    },
    orderBy: { executedAt: "desc" },
    take: 50,
  });

  return Response.json({ success: true, data: logs });
}
