import { decryptText } from "@/lib/encrypt";

type SessionCheckResult = {
  success: boolean;
  loginStatus: "ONLINE" | "EXPIRED" | "FAILED";
  message?: string;
  httpStatus?: number;
  matchedRule?: string;
  responseSummary?: string;
  responsePayload?: unknown;
};

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

async function requestWithCookie(url: string, cookie: string) {
  return fetch(url, {
    method: "GET",
    headers: {
      Cookie: cookie,
      Referer: "https://weibo.com/",
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/plain, */*",
      "X-Requested-With": "XMLHttpRequest",
    },
    cache: "no-store",
  });
}

function detectLoginFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;

  if (record.data && typeof record.data === "object") {
    const data = record.data as Record<string, unknown>;
    if (data.id || data.screen_name || data.user || data.userInfo) {
      return true;
    }
  }

  if (record.user || record.userInfo || record.screen_name || record.id) {
    return true;
  }

  return false;
}

function summarizePayload(payload: unknown) {
  if (typeof payload === "string") {
    return payload.replace(/\s+/g, " ").slice(0, 200);
  }

  if (payload && typeof payload === "object") {
    try {
      return JSON.stringify(payload).slice(0, 300);
    } catch {
      return "对象响应无法序列化";
    }
  }

  return "空响应";
}

export async function checkWeiboSession(cookieEncrypted: string): Promise<SessionCheckResult> {
  try {
    const cookie = decryptText(cookieEncrypted);

    const response = await requestWithCookie("https://weibo.com/ajax/profile/me", cookie);
    const text = await response.text();
    let payload: unknown = null;

    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        loginStatus: "EXPIRED",
        message: "登录态已失效或权限不足",
        httpStatus: response.status,
        matchedRule: "http_401_403",
        responseSummary: summarizePayload(payload),
        responsePayload: payload,
      };
    }

    if (response.ok && detectLoginFromPayload(payload)) {
      return {
        success: true,
        loginStatus: "ONLINE",
        message: "登录态有效",
        httpStatus: response.status,
        matchedRule: "payload_contains_user_identity",
        responseSummary: summarizePayload(payload),
        responsePayload: payload,
      };
    }

    if (typeof payload === "string") {
      const lowerText = payload.toLowerCase();
      if (lowerText.includes("login") || lowerText.includes("passport") || lowerText.includes("signin")) {
        return {
          success: false,
          loginStatus: "EXPIRED",
          message: "响应内容显示需要重新登录",
          httpStatus: response.status,
          matchedRule: "html_contains_login_keyword",
          responseSummary: summarizePayload(payload),
          responsePayload: payload,
        };
      }
    }

    return {
      success: false,
      loginStatus: "FAILED",
      message: "无法从微博响应中确认当前登录态",
      httpStatus: response.status,
      matchedRule: "unknown_response_shape",
      responseSummary: summarizePayload(payload),
      responsePayload: payload,
    };
  } catch (error) {
    return {
      success: false,
      loginStatus: "FAILED",
      message: error instanceof Error ? error.message : "检测登录态失败",
      matchedRule: "runtime_exception",
      responseSummary: error instanceof Error ? error.message : "未知异常",
    };
  }
}
