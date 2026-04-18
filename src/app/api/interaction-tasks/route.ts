import { prisma } from "@/lib/prisma";

export async function GET() {
  const tasks = await prisma.interactionTask.findMany({
    include: {
      account: true,
      target: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ success: true, data: tasks });
}
