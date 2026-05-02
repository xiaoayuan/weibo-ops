import { CacheManager } from "@/src/lib/cache";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

/**
 * 批量删除账号
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
        { success: false, message: "请提供要删除的账号 ID 列表" },
        { status: 400 }
      );
    }

    // 限制批量操作数量
    if (ids.length > 100) {
      return Response.json(
        { success: false, message: "单次最多删除 100 个账号" },
        { status: 400 }
      );
    }

    // 验证所有账号都属于当前用户
    const accounts = await prisma.weiboAccount.findMany({
      where: {
        id: { in: ids },
        ownerUserId: auth.session.id,
      },
      select: { id: true },
    });

    if (accounts.length !== ids.length) {
      return Response.json(
        { success: false, message: "部分账号不存在或无权限删除" },
        { status: 403 }
      );
    }

    // 批量删除
    const result = await prisma.weiboAccount.deleteMany({
      where: {
        id: { in: ids },
        ownerUserId: auth.session.id,
      },
    });

    // 清除缓存
    await CacheManager.delPattern(`accounts:user:${auth.session.id}:*`);

    return Response.json({
      success: true,
      message: `成功删除 ${result.count} 个账号`,
      data: { count: result.count },
    });
  } catch (error) {
    console.error("批量删除账号失败:", error);
    return Response.json(
      { success: false, message: "批量删除失败" },
      { status: 500 }
    );
  }
}
