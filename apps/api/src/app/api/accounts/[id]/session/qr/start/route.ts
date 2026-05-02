import { getProxyConfigForAccount } from "@/src/lib/proxy-config";
import { startWeiboQrLogin } from "@/src/lib/qr-login";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

export async function POST(_request: Request, context: RouteContext<"/api/accounts/[id]/session/qr/start">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const account = await prisma.weiboAccount.findUnique({
      where: { id },
      select: {
        id: true,
        ownerUserId: true,
      },
    });

    if (!account || account.ownerUserId !== auth.session.id) {
      return Response.json({ success: false, message: "账号不存在" }, { status: 404 });
    }

    const proxyConfig = await getProxyConfigForAccount(id);
    const result = await startWeiboQrLogin(auth.session.id, id, proxyConfig);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : "生成扫码二维码失败" }, { status: 500 });
  }
}
