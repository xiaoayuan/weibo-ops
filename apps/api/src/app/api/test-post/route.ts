import { prisma } from "@/src/lib/prisma";
import { requireApiRole } from "@/src/lib/permissions";

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

    // 获取账号
    const account = await prisma.weiboAccount.findFirst({
      where: { id: accountId, ownerUserId: auth.session.id },
      select: { id: true, nickname: true, cookie: true, loginStatus: true, proxyNodeId: true },
    });

    if (!account) {
      return Response.json({ success: false, message: "账号不存在或无权访问" }, { status: 404 });
    }

    if (!account.cookie) {
      return Response.json({ success: false, message: "账号未配置 Cookie，请先扫码登录" }, { status: 400 });
    }

    // 获取超话信息
    let topicName = "";
    let effectiveTopicUrl = topicUrl || "";

    if (superTopicId) {
      const topic = await prisma.superTopic.findUnique({
        where: { id: superTopicId },
        select: { id: true, name: true, topicUrl: true },
      });

      if (topic) {
        topicName = topic.name;
        effectiveTopicUrl = topicUrl || topic.topicUrl || "";
      }
    }

    if (!effectiveTopicUrl) {
      return Response.json({ success: false, message: "缺少超话链接（topicUrl 或 superTopicId）" }, { status: 400 });
    }

    // 获取代理
    let proxyConfig: { host: string; port: number; auth?: { username: string; password: string } } | null = null;
    if (account.proxyNodeId) {
      const proxyNode = await prisma.proxyNode.findUnique({
        where: { id: account.proxyNodeId },
        select: { host: true, port: true, username: true, password: true },
      });

      if (proxyNode) {
        proxyConfig = {
          host: proxyNode.host,
          port: proxyNode.port,
          ...(proxyNode.username ? { auth: { username: proxyNode.username, password: proxyNode.password || "" } } : {}),
        };
      }
    }

    // 执行发帖
    const { executeSinglePost } = await import("@/src/lib/weibo-executor");
    const result = await executeSinglePost(content, topicName, effectiveTopicUrl, account.cookie, proxyConfig);

    return Response.json({
      success: result.ok,
      data: {
        posted: result.ok,
        message: result.message,
        topicUrl: effectiveTopicUrl,
        topicName,
      },
      message: result.message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "发帖失败";
    return Response.json({ success: false, message }, { status: 500 });
  }
}