import { getVisibleAccountById, accountSelect } from "@/src/lib/accounts";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { autoAssignProxyBindingsForAccount, getAutoAssignableProxyNode } from "@/src/lib/proxy-pool";
import { createAccountSchema } from "@/src/lib/validators";

export async function GET() {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const accounts = await prisma.weiboAccount.findMany({
    where: { ownerUserId: auth.session.id },
    orderBy: { createdAt: "desc" },
    select: accountSelect,
  });

  return Response.json({ success: true, data: accounts });
}

export async function POST(request: Request) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = createAccountSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    let proxyNodeId: string | null = null;

    try {
      const proxyNode = await getAutoAssignableProxyNode(auth.session.id);
      proxyNodeId = proxyNode.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      if (!message.includes("暂无可用代理") && !message.includes("代理节点容量已满")) {
        throw error;
      }
    }

    const account = await prisma.weiboAccount.create({
      data: {
        ownerUserId: auth.session.id,
        proxyNodeId,
        nickname: parsed.data.nickname,
        remark: parsed.data.remark || null,
        groupName: parsed.data.groupName || null,
        status: parsed.data.status,
        scheduleWindowEnabled: parsed.data.scheduleWindowEnabled || false,
        executionWindowStart: parsed.data.executionWindowStart || null,
        executionWindowEnd: parsed.data.executionWindowEnd || null,
        baseJitterSec: parsed.data.baseJitterSec || 0,
      },
    });

    if (proxyNodeId) {
      await autoAssignProxyBindingsForAccount(account.id).catch(() => undefined);
    }

    const created = await getVisibleAccountById(account.id);

    return Response.json({
      success: true,
      data: created,
      message: proxyNodeId ? "账号已创建并自动绑定代理" : "账号已创建，当前未绑定代理",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建账号失败";
    const isUserError = message.includes("代理");

    return Response.json({ success: false, message }, { status: isUserError ? 400 : 500 });
  }
}
