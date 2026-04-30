import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { autoAssignProxyBindingsForAccount, getAutoAssignableProxyNode } from "@/server/proxy-pool";
import { createAccountSchema } from "@/server/validators/account";

export async function GET() {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const accounts = await prisma.weiboAccount.findMany({
    where: { ownerUserId: auth.session.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nickname: true,
      remark: true,
      groupName: true,
      status: true,
      loginStatus: true,
      riskLevel: true,
      uid: true,
      username: true,
      cookieUpdatedAt: true,
      lastCheckAt: true,
      loginErrorMessage: true,
      consecutiveFailures: true,
      scheduleWindowEnabled: true,
      executionWindowStart: true,
      executionWindowEnd: true,
      baseJitterSec: true,
      proxyNodeId: true,
      ownerUserId: true,
      createdAt: true,
      updatedAt: true,
      proxyNode: {
        select: {
          id: true,
          name: true,
          countryCode: true,
          rotationMode: true,
        },
      },
    },
  });

  return Response.json({
    success: true,
    data: accounts,
  });
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
      return Response.json(
        {
          success: false,
          message: "参数校验失败",
          errors: parsed.error.flatten(),
        },
        { status: 400 },
      );
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

    const created = await prisma.weiboAccount.findUnique({
      where: { id: account.id },
      select: {
        id: true,
        nickname: true,
        remark: true,
        groupName: true,
        status: true,
        loginStatus: true,
        riskLevel: true,
        uid: true,
        username: true,
        cookieUpdatedAt: true,
        lastCheckAt: true,
        loginErrorMessage: true,
        consecutiveFailures: true,
        scheduleWindowEnabled: true,
        executionWindowStart: true,
        executionWindowEnd: true,
        baseJitterSec: true,
        proxyNodeId: true,
        ownerUserId: true,
        createdAt: true,
        updatedAt: true,
        proxyNode: {
          select: {
            id: true,
            name: true,
            countryCode: true,
            rotationMode: true,
          },
        },
      },
    });

    return Response.json({
      success: true,
      data: created,
      message: proxyNodeId ? "账号已创建并自动绑定代理" : "账号已创建，当前未绑定代理",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建账号失败";
    const isUserError = message.includes("代理");

    return Response.json(
      {
        success: false,
        message,
      },
      { status: isUserError ? 400 : 500 },
    );
  }
}
