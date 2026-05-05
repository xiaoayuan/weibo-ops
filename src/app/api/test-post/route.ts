import { decryptText } from "@/lib/encrypt";
import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";
import { getProxyConfigForAccount } from "@/server/proxy-config";

/**
 * 测试发帖 API
 * 绕过计划系统，直接指定账号+超话+文案发帖
 */
export async function POST(request: Request) {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { accountId, superTopicId, content, topicUrl } = body;

    if (!accountId) {
      return Response.json({ success: false, message: "缺少 accountId" }, { status: 400 });
    }

    if (!content || !content.trim()) {
      return Response.json({ success: false, message: "缺少发帖内容" }, { status: 400 });
    }

    const account = await prisma.weiboAccount.findFirst({
      where: { id: accountId, ownerUserId: auth.session.id },
      select: { id: true, nickname: true, cookieEncrypted: true, loginStatus: true, proxyNodeId: true },
    });

    if (!account) {
      return Response.json({ success: false, message: "账号不存在或无权访问" }, { status: 404 });
    }

    if (!account.cookieEncrypted) {
      return Response.json({ success: false, message: "账号未配置 Cookie，请先扫码登录" }, { status: 400 });
    }

    let topicName = "";
    let effectiveTopicUrl = topicUrl || "";
    let postingUrl: string | undefined;

    if (superTopicId) {
      const topic = await prisma.superTopic.findUnique({
        where: { id: superTopicId },
        select: { id: true, name: true, topicUrl: true, postingUrl: true },
      });

      if (topic) {
        topicName = topic.name;
        effectiveTopicUrl = topicUrl || topic.topicUrl || "";
        postingUrl = topic.postingUrl || undefined;
      }
    }

    if (!effectiveTopicUrl) {
      return Response.json({ success: false, message: "缺少超话链接" }, { status: 400 });
    }

    if (!topicName) {
      topicName = "超话发帖";
    }

    const cookie = decryptText(account.cookieEncrypted);
    const proxyConfig = await getProxyConfigForAccount(accountId);

    const executor = new (await import("@/server/executors/weibo-executor")).WeiboExecutor();
    const result = await executor.executePlan({
      planId: `test-${Date.now()}`,
      accountId,
      accountNickname: account.nickname,
      accountLoginStatus: account.loginStatus,
      planType: "POST",
      topicName,
      topicUrl: effectiveTopicUrl,
      postingUrl,
      content: content.trim(),
    });

    await writeExecutionLog({
      accountId,
      actionType: result.success ? "PLAN_EXECUTE_SUCCESS" : "PLAN_EXECUTE_BLOCKED",
      requestPayload: { source: "test-post", topicName, topicUrl: effectiveTopicUrl, postingUrl, content: content.trim() },
      success: result.success,
      errorMessage: result.success ? undefined : result.message,
    });

    return Response.json({
      success: result.success,
      data: { message: result.message },
      message: result.message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "发帖失败";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
