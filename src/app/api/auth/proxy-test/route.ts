import { requireApiRole } from "@/lib/permissions";
import { sendHttpRequest } from "@/server/executors/http-client";
import { buildProxyConfig } from "@/server/proxy-config";
import { proxySettingsSchema } from "@/server/validators/auth";

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

export async function POST(request: Request) {
  const auth = await requireApiRole("VIEWER");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const parsed = proxySettingsSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ success: false, message: "代理参数校验失败", errors: parsed.error.flatten() }, { status: 400 });
    }

    const proxyConfig = buildProxyConfig(parsed.data);

    if (!proxyConfig) {
      return Response.json({ success: false, message: "请先填写完整代理配置并启用代理" }, { status: 400 });
    }

    const response = await sendHttpRequest({
      url: "https://weibo.com/",
      method: "GET",
      timeoutMs: 10_000,
      proxyConfig,
    });

    return Response.json({
      success: response.ok,
      code: response.ok ? "OK" : "HTTP_ERROR",
      message: response.ok ? "代理连通性测试通过" : `代理测试失败，目标返回 HTTP ${response.status}`,
      data: {
        status: response.status,
        finalUrl: response.finalUrl,
      },
    }, { status: response.ok ? 200 : 502 });
  } catch (error) {
    const normalized = normalizeProxyTestError(error);

    return Response.json(
      { success: false, code: normalized.code, message: normalized.message },
      { status: 500 },
    );
  }
}
