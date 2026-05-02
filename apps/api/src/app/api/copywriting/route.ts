import { CacheManager } from "@/src/lib/cache";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { createCopywritingSchema } from "@/src/lib/validators";

export async function GET() {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  // 缓存键
  const cacheKey = "copywriting:list";

  // 尝试从缓存获取
  const cached = await CacheManager.get<unknown[]>(cacheKey);

  if (cached) {
    return Response.json({
      success: true,
      data: cached,
      cached: true,
    });
  }

  const items = await prisma.copywritingTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });

  // 写入缓存（10 分钟，文案变化不频繁）
  await CacheManager.set(cacheKey, items, 600);

  return Response.json({
    success: true,
    data: items,
    cached: false,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = createCopywritingSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const item = await prisma.copywritingTemplate.create({
      data: parsed.data,
    });

    // 清除缓存
    await CacheManager.del("copywriting:list");

    return Response.json({ success: true, data: item });
  } catch {
    return Response.json({ success: false, message: "创建文案失败" }, { status: 500 });
  }
}
