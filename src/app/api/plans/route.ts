import { requireApiRole } from "@/lib/permissions";
import { toBusinessDate } from "@/lib/business-date";
import { prisma } from "@/lib/prisma";

async function maskForeignAccounts(plans: Array<{ account: { id: string; nickname: string; ownerUserId: string } }>, adminUserId: string) {
  const foreignOwnerIds = new Set<string>();
  for (const plan of plans) {
    if (plan.account.ownerUserId !== adminUserId) {
      foreignOwnerIds.add(plan.account.ownerUserId);
    }
  }
  if (foreignOwnerIds.size === 0) return plans;

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(foreignOwnerIds) } },
    select: { id: true, username: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.username]));

  for (const plan of plans) {
    if (plan.account.ownerUserId !== adminUserId) {
      plan.account.nickname = userMap.get(plan.account.ownerUserId) || plan.account.ownerUserId;
    }
  }
  return plans;
}

export async function GET(request: Request) {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  const where = {
    ...(date ? { planDate: toBusinessDate(date) } : {}),
    ...(auth.session.role !== "ADMIN"
      ? {
          account: {
            ownerUserId: auth.session.id,
          },
        }
      : {}),
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

  if (auth.session.role === "ADMIN") {
    await maskForeignAccounts(plans, auth.session.id);
  }

  return Response.json({ success: true, data: plans });
}
