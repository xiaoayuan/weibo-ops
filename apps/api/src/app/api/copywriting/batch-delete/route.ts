import { CacheManager } from "@/src/lib/cache";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

/**
 * 批量删除文案
 */
export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { ids } = body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json(
        { success: false, message: "请提供要删除的文案 ID 列表" },
        { status: 400 }
      );
    }

    // 限制批量操作数量
    if (ids.length > 100) {
      return Response.json(
        { success: false, message: "单次最多删除 100 条文案" },
        { status: 400 }
      );
    }

    // 批量删除
    const result = await prisma.copywritingTemplate.deleteMany({
      where: { id: { in: ids } },
    });

    // 清除缓存
    await CacheManager.del("copywriting:list");

    return Response.json({
      success: true,
      message: `成功删除 ${result.count} 条文案`,
      data: { count: result.count },
    });
  } catch (error) {
    console.error("批量删除文案失败:", error);
    return Response.json(
      { success: false, message: "批量删除失败" },
      { status: 500 }
    );
  }
}
