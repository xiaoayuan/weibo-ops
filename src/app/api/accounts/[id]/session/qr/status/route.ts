import { encryptText } from "@/lib/encrypt";
import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";
import { checkWeiboSession } from "@/server/weibo/session-checker";
import { markWeiboQrLoginPersisted, pollWeiboQrLogin } from "@/server/weibo/qr-login";

export async function GET(request: Request, context: RouteContext<"/api/accounts/[id]/session/qr/status">) {
  const auth = await requireApiRole("OPERATOR");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return Response.json({ success: false, message: "缺少 sessionId" }, { status: 400 });
  }

  try {
    const account = await prisma.weiboAccount.findUnique({
      where: { id },
      select: {
        id: true,
        ownerUserId: true,
        nickname: true,
      },
    });

    if (!account || account.ownerUserId !== auth.session.id) {
      return Response.json({ success: false, message: "账号不存在" }, { status: 404 });
    }

    const qrStatus = await pollWeiboQrLogin(sessionId, auth.session.id, id);

    if (qrStatus.state !== "CONFIRMED" || !qrStatus.cookieText || qrStatus.persisted) {
      return Response.json({ success: true, data: qrStatus });
    }

    const encryptedCookie = encryptText(qrStatus.cookieText);
    let checkResult;
    try {
      checkResult = await checkWeiboSession(encryptedCookie);
    } catch {
      checkResult = { success: false, loginStatus: "FAILED" as const, message: "检测暂不可用", attempts: [] };
    }
    const shouldAutoRename = Boolean(qrStatus.username && (!account.nickname.trim() || account.nickname.startsWith("未命名账号")));

    const updated = await prisma.weiboAccount.update({
      where: { id },
      data: {
        nickname: shouldAutoRename ? qrStatus.username : undefined,
        uid: qrStatus.uid || undefined,
        username: qrStatus.username || undefined,
        cookieEncrypted: encryptedCookie,
        cookieUpdatedAt: new Date(),
        loginStatus: checkResult.loginStatus,
        lastCheckAt: new Date(),
        loginErrorMessage: checkResult.success ? null : checkResult.message || "检测失败",
        consecutiveFailures: checkResult.success ? 0 : { increment: 1 },
      },
      select: {
        id: true,
        nickname: true,
        uid: true,
        username: true,
        loginStatus: true,
        cookieUpdatedAt: true,
        lastCheckAt: true,
        loginErrorMessage: true,
        consecutiveFailures: true,
      },
    });

    await writeExecutionLog({
      accountId: updated.id,
      actionType: "ACCOUNT_SESSION_SAVED",
      requestPayload: {
        source: "QR_LOGIN",
        uid: updated.uid,
        username: updated.username,
      },
      responsePayload: {
        state: qrStatus.state,
        checkMatchedRule: checkResult.matchedRule,
      },
      success: checkResult.success,
      errorMessage: checkResult.success ? undefined : checkResult.message,
    });

    markWeiboQrLoginPersisted(sessionId, auth.session.id, id);

    return Response.json({
      success: true,
      data: {
        ...qrStatus,
        persisted: true,
        account: updated,
      },
      message: checkResult.success ? "扫码登录成功并已保存 Cookie" : "扫码登录完成，但登录态检测失败，请重试",
    });
  } catch (error) {
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : "查询扫码状态失败" },
      { status: 500 },
    );
  }
}
