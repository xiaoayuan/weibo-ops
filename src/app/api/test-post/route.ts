import { decryptText, getDecryptErrorMessage } from "@/lib/encrypt";
import { requireApiRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeExecutionLog } from "@/server/logs";
import { getProxyConfigForAccount } from "@/server/proxy-config";

/** 过滤不可 JSON 序列化的字段（如函数、undefined、BigInt） */
function filterUnserializable(obj: Record<string, unknown>): Record<string, unknown> {
  const seen = new WeakSet();
  function replacer(_key: string, value: unknown): unknown {
    if (typeof value === "function" || typeof value === "undefined" || typeof value === "bigint") return undefined;
    if (typeof value === "object" && value !== null) {
      if (seen.has(value as object)) return "[Circular]";
      seen.add(value as object);
    }
    return value;
  }
  return JSON.parse(JSON.stringify(obj, replacer));
}

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

    // 调试：检查 executePlan 返回的完整 responsePayload（过滤不可序列化的字段）
    let debugSummary = "N/A";
    let stage = result.stage ?? "UNKNOWN";
    let status = result.status ?? "UNKNOWN";
    try {
      const safePayload = result.responsePayload && typeof result.responsePayload === "object"
        ? filterUnserializable(result.responsePayload as Record<string, unknown>)
        : result.responsePayload;
      debugSummary = JSON.stringify(safePayload).substring(0, 2000);
    } catch (e) {
      debugSummary = `序列化失败: ${e instanceof Error ? e.message : String(e)}`;
    }
    console.log(`[test-post] success=${result.success} stage=${stage} status=${status} message=${result.message} summary=${debugSummary.substring(0, 800)}`);

    await writeExecutionLog({
      accountId,
      actionType: result.success ? "PLAN_EXECUTE_SUCCESS" : "PLAN_EXECUTE_BLOCKED",
      requestPayload: { source: "test-post", topicName, topicUrl: effectiveTopicUrl, postingUrl, content: content.trim() },
      responsePayload: { success: result.success, message: result.message, stage, status, summary: debugSummary },
      success: result.success,
      errorMessage: result.success ? undefined : result.message,
    });

    return Response.json({
      success: result.success,
      data: { message: result.message, stage, status },
      message: result.message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "发帖失败";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
