import { decryptText } from "@/src/lib/encrypt";

type CandidateCheckDetail = {
  url: string;
  httpStatus?: number;
  matchedRule?: string;
  responseSummary?: string;
};

type SessionCheckResult = {
  success: boolean;
  loginStatus: "ONLINE" | "EXPIRED" | "FAILED";
  message?: string;
  httpStatus?: number;
  matchedRule?: string;
  responseSummary?: string;
  responsePayload?: unknown;
  attempts: CandidateCheckDetail[];
};

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

const CHECK_CANDIDATES = [
  "https://weibo.com/ajax/profile/info?custom=1",
  "https://weibo.com/ajax/profile/me",
  "https://weibo.com/u/page/fav/like",
];

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

  return Boolean(record.user || record.userInfo || record.screen_name || record.id);
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

async function checkCandidate(url: string, cookie: string) {
  const response = await requestWithCookie(url, cookie);
  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }

  const responseSummary = summarizePayload(payload);

  if (response.status === 401 || response.status === 403) {
    return {
      success: false,
      loginStatus: "EXPIRED" as const,
      message: "登录态已失效或权限不足",
      httpStatus: response.status,
      matchedRule: "http_401_403",
      responseSummary,
      responsePayload: payload,
    };
  }

  if (response.ok && detectLoginFromPayload(payload)) {
    return {
      success: true,
      loginStatus: "ONLINE" as const,
      message: "登录态有效",
      httpStatus: response.status,
      matchedRule: "payload_contains_user_identity",
      responseSummary,
      responsePayload: payload,
    };
  }

  if (typeof payload === "string") {
    const lowerText = payload.toLowerCase();
    if (lowerText.includes("login") || lowerText.includes("passport") || lowerText.includes("signin")) {
      return {
        success: false,
        loginStatus: "EXPIRED" as const,
        message: "响应内容显示需要重新登录",
        httpStatus: response.status,
        matchedRule: "html_contains_login_keyword",
        responseSummary,
        responsePayload: payload,
      };
    }
  }

  return {
    success: false,
    loginStatus: "FAILED" as const,
    message: "无法从微博响应中确认当前登录态",
    httpStatus: response.status,
    matchedRule: response.status === 404 ? "endpoint_not_found" : "unknown_response_shape",
    responseSummary,
    responsePayload: payload,
  };
}

function buildMessage(result: Omit<SessionCheckResult, "attempts">) {
  const extras = [
    result.httpStatus ? `HTTP ${result.httpStatus}` : null,
    result.matchedRule ? `规则: ${result.matchedRule}` : null,
    result.responseSummary ? `摘要: ${result.responseSummary}` : null,
  ].filter(Boolean);

  return [result.message || "检测失败", ...extras].join(" | ");
}

export async function checkWeiboSession(cookieEncrypted: string): Promise<SessionCheckResult> {
  const attempts: CandidateCheckDetail[] = [];

  try {
    const cookie = decryptText(cookieEncrypted);

    let lastFailedResult: Omit<SessionCheckResult, "attempts"> = {
      success: false,
      loginStatus: "FAILED",
      message: "所有检测地址均未确认当前登录态",
    };

    for (const url of CHECK_CANDIDATES) {
      const result = await checkCandidate(url, cookie);

      attempts.push({
        url,
        httpStatus: result.httpStatus,
        matchedRule: result.matchedRule,
        responseSummary: result.responseSummary,
      });

      if (result.success || result.loginStatus === "EXPIRED") {
        return {
          ...result,
          message: buildMessage(result),
          attempts,
        };
      }

      lastFailedResult = result;
    }

    return {
      ...lastFailedResult,
      message: `所有检测地址均失败 | ${buildMessage(lastFailedResult)}`,
      attempts,
    };
  } catch (error) {
    const failedResult: Omit<SessionCheckResult, "attempts"> = {
      success: false,
      loginStatus: "FAILED",
      message: error instanceof Error ? error.message : "检测登录态失败",
      matchedRule: "runtime_exception",
      responseSummary: error instanceof Error ? error.message : "未知异常",
    };

    return {
      ...failedResult,
      message: buildMessage(failedResult),
      attempts,
    };
  }
}
