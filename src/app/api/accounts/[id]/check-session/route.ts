import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";
import { checkWeiboSession } from "@/server/weibo/session-checker";

export async function POST(_request: Request, context: RouteContext<"/api/accounts/[id]/check-session">) {
  const { id } = await context.params;

  try {
    const account = await prisma.weiboAccount.findUnique({ where: { id } });

    if (!account) {
      return Response.json({ success: false, message: "账号不存在" }, { status: 404 });
    }

    if (!account.cookieEncrypted) {
      return Response.json({ success: false, message: "该账号尚未录入 Cookie" }, { status: 400 });
    }

    const result = await checkWeiboSession(account.cookieEncrypted);
    const updated = await prisma.weiboAccount.update({
      where: { id },
      data: {
        loginStatus: result.loginStatus,
        lastCheckAt: new Date(),
        loginErrorMessage: result.success ? null : result.message || "检测失败",
        consecutiveFailures: result.success ? 0 : { increment: 1 },
      },
    });

    await writeExecutionLog({
      accountId: updated.id,
      actionType: "ACCOUNT_SESSION_CHECKED",
      responsePayload: {
        httpStatus: result.httpStatus,
        matchedRule: result.matchedRule,
        responseSummary: result.responseSummary,
        attempts: result.attempts,
        responsePayload: result.responsePayload,
      },
      success: result.success,
      errorMessage: result.success ? undefined : result.message,
    });

    return Response.json({
      success: result.success,
      message: result.message,
      data: {
        id: updated.id,
        loginStatus: updated.loginStatus,
        lastCheckAt: updated.lastCheckAt,
        loginErrorMessage: updated.loginErrorMessage,
        consecutiveFailures: updated.consecutiveFailures,
      },
    });
  } catch {
    return Response.json({ success: false, message: "检测登录态失败" }, { status: 500 });
  }
}
