import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { toBusinessDate } from "@/src/lib/business-date";

export async function GET(request: Request) {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  const where = {
    ...(date ? { planDate: toBusinessDate(date) } : {}),
    account: {
      ownerUserId: auth.session.id,
    },
  };

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
