import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const tasks = await prisma.interactionTask.findMany({
    include: {
      account: true,
      target: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ success: true, data: tasks });
}
