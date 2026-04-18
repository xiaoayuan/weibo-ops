import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  const where = date ? { planDate: new Date(`${date}T00:00:00`) } : undefined;

  const plans = await prisma.dailyPlan.findMany({
    where,
    include: {
      account: true,
      content: true,
      task: {
        include: {
          superTopic: true,
        },
      },
    },
    orderBy: { scheduledTime: "asc" },
  });

  return Response.json({ success: true, data: plans });
}
