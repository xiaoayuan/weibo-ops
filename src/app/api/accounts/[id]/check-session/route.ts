import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";
import { checkWeiboSession } from "@/server/weibo/session-checker";

function formatCheckMessage(result: Awaited<ReturnType<typeof checkWeiboSession>>) {
  if (result.success) {
    return result.message || "登录态有效";
  }

  const extras = [
    result.httpStatus ? `HTTP ${result.httpStatus}` : null,
    result.matchedRule ? `规则: ${result.matchedRule}` : null,
    result.responseSummary ? `摘要: ${result.responseSummary}` : null,
  ].filter(Boolean);

  return [result.message || "检测失败", ...extras].join(" | ");
}

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
    const formattedMessage = formatCheckMessage(result);
    const updated = await prisma.weiboAccount.update({
      where: { id },
      data: {
        loginStatus: result.loginStatus,
        lastCheckAt: new Date(),
        loginErrorMessage: result.success ? null : formattedMessage,
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
        responsePayload: result.responsePayload,
      },
      success: result.success,
      errorMessage: result.success ? undefined : formattedMessage,
    });

    return Response.json({
      success: result.success,
      message: formattedMessage,
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
