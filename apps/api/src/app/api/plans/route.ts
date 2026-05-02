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
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50"), 100);
  const skip = (page - 1) * pageSize;

  const where = {
    ...(date ? { planDate: toBusinessDate(date) } : {}),
    account: {
      ownerUserId: auth.session.id,
    },
  };

  const [plans, total] = await Promise.all([
    prisma.dailyPlan.findMany({
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
        content: true,
        task: {
          include: {
            superTopic: true,
          },
        },
      },
      orderBy: { scheduledTime: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.dailyPlan.count({ where }),
  ]);

  return Response.json({
    success: true,
    data: plans,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
