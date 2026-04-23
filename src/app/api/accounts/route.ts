import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/permissions";
import { getAutoAssignableProxyNode } from "@/server/proxy-pool";
import { createAccountSchema } from "@/server/validators/account";

export async function GET() {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  const accounts = await prisma.weiboAccount.findMany({
    where: { ownerUserId: auth.session.id },
    orderBy: { createdAt: "desc" },
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

    const proxyNode = await getAutoAssignableProxyNode(auth.session.id);

    const account = await prisma.weiboAccount.create({
      data: {
        ownerUserId: auth.session.id,
        proxyNodeId: proxyNode.id,
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

    return Response.json({
      success: true,
      data: account,
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
