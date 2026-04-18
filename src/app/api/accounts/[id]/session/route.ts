import { encryptText } from "@/lib/encrypt";
import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";
import { saveAccountSessionSchema } from "@/server/validators/account-session";

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
      return Response.json(
        {
          success: false,
          message: "参数校验失败",
          errors: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const existing = await prisma.weiboAccount.findUnique({
      where: { id },
    });

    if (!existing) {
      return Response.json({ success: false, message: "账号不存在" }, { status: 404 });
    }

    const updated = await prisma.weiboAccount.update({
      where: { id },
      data: {
        uid: parsed.data.uid,
        username: parsed.data.username,
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
        uid: parsed.data.uid,
        username: parsed.data.username,
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
