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

  // 生成缓存键（仅对无日期筛选的查询缓存，带日期的查询不缓存以确保数据时效性）
  const shouldCache = !date;
  const cacheKey = shouldCache ? `plans:user:${auth.session.id}:date:all:page:${page}:size:${pageSize}` : null;

  // 尝试从缓存获取
  if (shouldCache) {
    const cached = await CacheManager.get<{ plans: unknown[]; total: number }>(cacheKey!);
    if (cached) {
      return Response.json({
        success: true,
        data: cached.plans,
        pagination: { page, pageSize, total: cached.total, totalPages: Math.ceil(cached.total / pageSize) },
        cached: true,
      });
    }
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

  // 仅缓存无日期筛选的查询结果（2 分钟）
  if (shouldCache) {
    await CacheManager.set(cacheKey!, { plans, total }, 120);
  }

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
