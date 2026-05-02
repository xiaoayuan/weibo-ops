import { CacheManager } from "@/src/lib/cache";
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

  // 生成缓存键
  const cacheKey = `plans:user:${auth.session.id}:date:${date || "all"}:page:${page}:size:${pageSize}`;

  // 尝试从缓存获取
  const cached = await CacheManager.get<{
    plans: unknown[];
    total: number;
  }>(cacheKey);

  if (cached) {
    return Response.json({
      success: true,
      data: cached.plans,
      pagination: {
        page,
        pageSize,
        total: cached.total,
        totalPages: Math.ceil(cached.total / pageSize),
      },
      cached: true,
    });
  }

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

  // 写入缓存（2 分钟，因为计划状态变化较快）
  await CacheManager.set(cacheKey, { plans, total }, 120);

  return Response.json({
    success: true,
    data: plans,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    cached: false,
  });
}
