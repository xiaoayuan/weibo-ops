export type ExecutionErrorClass =
  | "SUCCESS"
  | "TARGET_ISSUE"
  | "CONTENT_ISSUE"
  | "TRANSIENT_NETWORK"
  | "PLATFORM_BUSY"
  | "ACCOUNT_RISK"
  | "UNKNOWN_FAILURE";

type ClassifyInput = {
  success: boolean;
  message?: string | null;
  responsePayload?: unknown;
};

const targetIssueKeywords = [
  "未找到可用的 0 回复帖子",
  "没搜到首评",
  "目标不存在",
  "链接失效",
  "已大于20条",
  "评论数已大于20条",
  "找不到微博",
  "status not found",
  "target not found",
  "not found",
  "deleted",
  "已删除",
];

const contentIssueKeywords = ["文案", "模板", "内容为空", "content missing", "template"];

const networkKeywords = [
  "timeout",
  "timed out",
  "etimedout",
  "econnreset",
  "econnrefused",
  "network",
  "socket hang up",
  "代理",
  "proxy",
  "连接失败",
];

const platformBusyKeywords = ["系统繁忙", "稍后再试", "busy", "please try again", "100001"];

const accountRiskKeywords = [
  "cookie",
  "登录失效",
  "请先登录",
  "账号异常",
  "行为异常",
  "频率限制",
  "访问受限",
  "验证码",
  "风控",
  "账号受限",
  "invalid session",
  "login required",
  "risk",
  "rate limit",
  "forbidden",
  "unauthorized",
];

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

export function classifyExecutionOutcome(input: ClassifyInput): ExecutionErrorClass {
  if (input.success) {
    return "SUCCESS";
  }

  const payloadText = JSON.stringify(input.responsePayload || "").toLowerCase();
  const messageText = String(input.message || "").toLowerCase();
  const text = `${messageText} ${payloadText}`;

  if (includesAny(text, accountRiskKeywords)) {
    return "ACCOUNT_RISK";
  }

  if (includesAny(text, platformBusyKeywords)) {
    return "PLATFORM_BUSY";
  }

  if (includesAny(text, networkKeywords)) {
    return "TRANSIENT_NETWORK";
  }

  if (includesAny(text, targetIssueKeywords)) {
    return "TARGET_ISSUE";
  }

  if (includesAny(text, contentIssueKeywords)) {
    return "CONTENT_ISSUE";
  }

  return "UNKNOWN_FAILURE";
}
