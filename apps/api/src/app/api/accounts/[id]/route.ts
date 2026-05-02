import { accountSelect, getVisibleAccountById } from "@/src/lib/accounts";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { autoAssignProxyBindingsForAccount } from "@/src/lib/proxy-pool";
import { updateAccountSchema } from "@/src/lib/validators";
import { WSPusher } from "@/src/lib/ws-pusher";

export async function GET(_request: Request, context: RouteContext<"/api/accounts/[id]">) {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const account = await getVisibleAccountById(id);

  if (!account || account.ownerUserId !== auth.session.id) {
    return Response.json({ success: false, message: "账号不存在" }, { status: 404 });
  }

  return Response.json({ success: true, data: account });
}

export async function PATCH(request: Request, context: RouteContext<"/api/accounts/[id]">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = updateAccountSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.weiboAccount.findUnique({ where: { id } });

    if (!existing || existing.ownerUserId !== auth.session.id) {
      return Response.json({ success: false, message: "账号不存在" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      nickname: parsed.data.nickname,
      remark: parsed.data.remark === "" ? null : parsed.data.remark,
      groupName: parsed.data.groupName === "" ? null : parsed.data.groupName,
      status: parsed.data.status,
      scheduleWindowEnabled: parsed.data.scheduleWindowEnabled,
      executionWindowStart: parsed.data.executionWindowStart === "" ? null : parsed.data.executionWindowStart,
      executionWindowEnd: parsed.data.executionWindowEnd === "" ? null : parsed.data.executionWindowEnd,
      baseJitterSec: parsed.data.baseJitterSec,
    };

    for (const key of Object.keys(updateData)) {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    }

    await prisma.weiboAccount.update({ where: { id }, data: updateData });
    await autoAssignProxyBindingsForAccount(id).catch(() => undefined);

    const refreshed = await prisma.weiboAccount.findUnique({ where: { id }, select: accountSelect });
    
    // 推送账号更新通知
    WSPusher.pushAccountUpdate(id, refreshed);
    
    return Response.json({ success: true, data: refreshed });
  } catch (error) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : "更新账号失败" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/accounts/[id]">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const existing = await prisma.weiboAccount.findUnique({ where: { id } });

    if (!existing || existing.ownerUserId !== auth.session.id) {
      return Response.json({ success: false, message: "账号不存在" }, { status: 404 });
    }

    await prisma.weiboAccount.delete({ where: { id } });
    return Response.json({ success: true, message: "删除成功" });
  } catch {
    return Response.json({ success: false, message: "删除账号失败" }, { status: 500 });
  }
}
