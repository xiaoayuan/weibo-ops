import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const rawTasks = await prisma.interactionTask.findMany({
    where: {
      account: {
        ownerUserId: auth.session.id,
      },
    },
    include: {
      account: {
        select: {
          id: true,
          nickname: true,
          ownerUserId: true,
        },
      },
      target: true,
      content: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const tasks = rawTasks.map((task) => ({
    ...task,
    isOwned: true,
  }));

  return Response.json({ success: true, data: tasks });
}
