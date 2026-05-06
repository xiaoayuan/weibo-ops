import { requireApiRole } from "@/lib/permissions";
import { toBusinessDate } from "@/lib/business-date";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  // 管理员只看自己账号的计划，不显示其他用户的计划
  // 如需查看其他用户数据，请使用执行日志页面
  const where = {
    ...(date ? { planDate: toBusinessDate(date) } : {}),
    account: {
      ownerUserId: auth.session.id,
    },
  };

  const plans = await prisma.dailyPlan.findMany({
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
    orderBy: { scheduledTime: "asc" },
  });

  return Response.json({ success: true, data: plans });
}
