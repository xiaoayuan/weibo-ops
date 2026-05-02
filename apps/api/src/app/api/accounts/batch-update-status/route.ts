import { CacheManager } from "@/src/lib/cache";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

/**
 * 批量更新账号状态
 */
export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { ids, status } = body as {
      ids: string[];
      status: "ACTIVE" | "DISABLED" | "RISKY" | "EXPIRED";
    };

    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json(
        { success: false, message: "请提供要更新的账号 ID 列表" },
        { status: 400 }
      );
    }

    if (!["ACTIVE", "DISABLED", "RISKY", "EXPIRED"].includes(status)) {
      return Response.json(
        { success: false, message: "无效的状态值" },
        { status: 400 }
      );
    }

    // 限制批量操作数量
    if (ids.length > 100) {
      return Response.json(
        { success: false, message: "单次最多更新 100 个账号" },
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
        { success: false, message: "部分账号不存在或无权限更新" },
        { status: 403 }
      );
    }

    // 批量更新
    const result = await prisma.weiboAccount.updateMany({
      where: {
        id: { in: ids },
        ownerUserId: auth.session.id,
      },
      data: { status },
    });

    // 清除缓存
    await CacheManager.delPattern(`accounts:user:${auth.session.id}:*`);

    return Response.json({
      success: true,
      message: `成功更新 ${result.count} 个账号状态`,
      data: { count: result.count },
    });
  } catch (error) {
    console.error("批量更新账号状态失败:", error);
    return Response.json(
      { success: false, message: "批量更新失败" },
      { status: 500 }
    );
  }
}
