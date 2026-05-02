import { CacheManager } from "@/src/lib/cache";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

/**
 * 批量删除计划
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
        { success: false, message: "请提供要删除的计划 ID 列表" },
        { status: 400 }
      );
    }

    // 限制批量操作数量
    if (ids.length > 100) {
      return Response.json(
        { success: false, message: "单次最多删除 100 个计划" },
        { status: 400 }
      );
    }

    // 验证所有计划都属于当前用户的账号
    const plans = await prisma.dailyPlan.findMany({
      where: {
        id: { in: ids },
        account: {
          ownerUserId: auth.session.id,
        },
      },
      select: { id: true },
    });

    if (plans.length !== ids.length) {
      return Response.json(
        { success: false, message: "部分计划不存在或无权限删除" },
        { status: 403 }
      );
    }

    // 批量删除
    const result = await prisma.dailyPlan.deleteMany({
      where: {
        id: { in: ids },
        account: {
          ownerUserId: auth.session.id,
        },
      },
    });

    // 清除缓存
    await CacheManager.delPattern(`plans:user:${auth.session.id}:*`);

    return Response.json({
      success: true,
      message: `成功删除 ${result.count} 个计划`,
      data: { count: result.count },
    });
  } catch (error) {
    console.error("批量删除计划失败:", error);
    return Response.json(
      { success: false, message: "批量删除失败" },
      { status: 500 }
    );
  }
}
