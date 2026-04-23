import { requireApiRole } from "@/lib/permissions";
import { sendHttpRequest } from "@/server/executors/http-client";
import { getProxyConfigForNode } from "@/server/proxy-pool";

function normalizeProxyTestError(error: unknown) {
  const message = error instanceof Error ? error.message : "代理测试失败";
  const lower = message.toLowerCase();

  if (message.includes("超时")) {
    return { code: "TIMEOUT", message: "代理连接超时，请检查主机、端口或网络" };
  }

  if (lower.includes("authentication") || lower.includes("auth") || lower.includes("407")) {
    return { code: "AUTH_FAILED", message: "代理认证失败，请检查用户名和密码" };
  }

  if (lower.includes("econnrefused") || message.includes("连接被拒绝")) {
    return { code: "CONNECTION_REFUSED", message: "代理连接被拒绝，请确认服务和端口已开放" };
  }

  if (lower.includes("enotfound") || lower.includes("eai_again") || message.includes("dns")) {
    return { code: "DNS_ERROR", message: "代理主机解析失败，请检查主机名或 DNS" };
  }

  return { code: "UNKNOWN_ERROR", message };
}

export async function POST(_request: Request, context: RouteContext<"/api/proxy-nodes/[id]/test">) {
  const auth = await requireApiRole("ADMIN");

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const node = await getProxyConfigForNode(auth.session.id, id);

    if (!node.enabled) {
      return Response.json({ success: false, code: "DISABLED", message: "代理节点已停用，请先启用后再测试" }, { status: 400 });
    }

    const [ipResponse, weiboResponse] = await Promise.all([
      sendHttpRequest({
        url: "https://api64.ipify.org",
        method: "GET",
        timeoutMs: 10_000,
        proxyConfig: node.proxyConfig,
      }),
      sendHttpRequest({
        url: "https://weibo.com/",
        method: "GET",
        timeoutMs: 10_000,
        proxyConfig: node.proxyConfig,
      }),
    ]);

    const ipText = ipResponse.text.trim();
    const ip = ipText.includes("\n") ? ipText.split("\n")[0] : ipText;
    const ok = ipResponse.ok && weiboResponse.ok;

    return Response.json(
      {
        success: ok,
        code: ok ? "OK" : "HTTP_ERROR",
        message: ok ? "代理连通性测试通过" : `代理测试失败，微博返回 HTTP ${weiboResponse.status}`,
        data: {
          nodeId: node.id,
          nodeName: node.name,
          ip,
          ipStatus: ipResponse.status,
          weiboStatus: weiboResponse.status,
          weiboFinalUrl: weiboResponse.finalUrl,
        },
      },
      { status: ok ? 200 : 502 },
    );
  } catch (error) {
    const normalized = normalizeProxyTestError(error);

    return Response.json({ success: false, code: normalized.code, message: normalized.message }, { status: 500 });
  }
}
