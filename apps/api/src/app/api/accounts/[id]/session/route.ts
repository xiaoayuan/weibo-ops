import { encryptText } from "@/src/lib/encrypt";
import { writeExecutionLog } from "@/src/lib/execution-log";
import { requireApiRole } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { saveAccountSessionSchema } from "@/src/lib/validators";

export async function POST(request: Request, context: RouteContext<"/api/accounts/[id]/session">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = saveAccountSessionSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.weiboAccount.findUnique({ where: { id } });

    if (!existing || existing.ownerUserId !== auth.session.id) {
      return Response.json({ success: false, message: "账号不存在" }, { status: 404 });
    }

    const updated = await prisma.weiboAccount.update({
      where: { id },
      data: {
        nickname:
          parsed.data.username?.trim() && (!existing.nickname.trim() || existing.nickname.startsWith("未命名账号"))
            ? parsed.data.username.trim()
            : undefined,
        uid: parsed.data.uid?.trim() ? parsed.data.uid.trim() : existing.uid,
        username: parsed.data.username?.trim() ? parsed.data.username.trim() : existing.username,
        cookieEncrypted: encryptText(parsed.data.cookie),
        cookieUpdatedAt: new Date(),
        loginStatus: "UNKNOWN",
        loginErrorMessage: null,
        consecutiveFailures: 0,
      },
    });

    await writeExecutionLog({
      accountId: updated.id,
      actionType: "ACCOUNT_SESSION_SAVED",
      requestPayload: {
        uid: parsed.data.uid?.trim() || updated.uid,
        username: parsed.data.username?.trim() || updated.username,
      },
      success: true,
    });

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        uid: updated.uid,
        username: updated.username,
        loginStatus: updated.loginStatus,
        cookieUpdatedAt: updated.cookieUpdatedAt,
      },
    });
  } catch {
    return Response.json({ success: false, message: "保存登录态失败" }, { status: 500 });
  }
}
