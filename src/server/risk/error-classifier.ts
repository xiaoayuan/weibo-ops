import type { RiskRules } from "@/server/risk/rules";

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

type StructuredErrorCode =
  | "ACCOUNT_NOT_ONLINE"
  | "LOGIN_REQUIRED"
  | "LOGIN_EXPIRED"
  | "SESSION_INVALID"
  | "CONNECTIVITY_PROBE_FAILED"
  | "TIMEOUT"
  | "DNS_ERROR"
  | "CONNECTION_REFUSED"
  | "AUTH_FAILED"
  | "NETWORK_ERROR"
  | "MISSING_TOPIC"
  | "MISSING_TOPIC_URL"
  | "MISSING_TARGET_URL"
  | "INVALID_TARGET_URL"
  | "MISSING_COMMENT_TEXT"
  | "MISSING_CONTENT"
  | "POST_DISABLED"
  | "ACCOUNT_RISK"
  | "TARGET_ISSUE"
  | "CONTENT_ISSUE"
  | "TRANSIENT_NETWORK"
  | "PLATFORM_BUSY"
  | "UNKNOWN_FAILURE";

const structuredReasonMap: Partial<Record<StructuredErrorCode, ExecutionErrorClass>> = {
  ACCOUNT_NOT_ONLINE: "ACCOUNT_RISK",
  LOGIN_REQUIRED: "ACCOUNT_RISK",
  LOGIN_EXPIRED: "ACCOUNT_RISK",
  SESSION_INVALID: "ACCOUNT_RISK",
  CONNECTIVITY_PROBE_FAILED: "TRANSIENT_NETWORK",
  TIMEOUT: "TRANSIENT_NETWORK",
  DNS_ERROR: "TRANSIENT_NETWORK",
  CONNECTION_REFUSED: "TRANSIENT_NETWORK",
  AUTH_FAILED: "TRANSIENT_NETWORK",
  NETWORK_ERROR: "TRANSIENT_NETWORK",
  MISSING_TOPIC: "TARGET_ISSUE",
  MISSING_TOPIC_URL: "TARGET_ISSUE",
  MISSING_TARGET_URL: "TARGET_ISSUE",
  INVALID_TARGET_URL: "TARGET_ISSUE",
  MISSING_COMMENT_TEXT: "CONTENT_ISSUE",
  MISSING_CONTENT: "CONTENT_ISSUE",
  POST_DISABLED: "CONTENT_ISSUE",
  ACCOUNT_RISK: "ACCOUNT_RISK",
  TARGET_ISSUE: "TARGET_ISSUE",
  CONTENT_ISSUE: "CONTENT_ISSUE",
  TRANSIENT_NETWORK: "TRANSIENT_NETWORK",
  PLATFORM_BUSY: "PLATFORM_BUSY",
};

function extractStructuredCode(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const rawCode = candidate.code ?? candidate.reason ?? candidate.errorCode;

  if (typeof rawCode !== "string") {
    return undefined;
  }

  const normalized = rawCode.trim().toUpperCase();

  return normalized || undefined;
}

function classifyStructuredCode(code: string): ExecutionErrorClass | undefined {
  if (code in structuredReasonMap) {
    return structuredReasonMap[code as StructuredErrorCode];
  }

  return undefined;
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

export function classifyExecutionOutcome(input: ClassifyInput, rules: RiskRules): ExecutionErrorClass {
  if (input.success) {
    return "SUCCESS";
  }

  const structuredCode = extractStructuredCode(input.responsePayload);

  if (structuredCode) {
    const structuredClass = classifyStructuredCode(structuredCode);

    if (structuredClass) {
      return structuredClass;
    }
  }

  const payloadText = JSON.stringify(input.responsePayload || "").toLowerCase();
  const messageText = String(input.message || "").toLowerCase();
  const text = `${messageText} ${payloadText}`;

  if (includesAny(text, rules.keywords.accountRisk)) {
    return "ACCOUNT_RISK";
  }

  if (includesAny(text, rules.keywords.platformBusy)) {
    return "PLATFORM_BUSY";
  }

  if (includesAny(text, rules.keywords.transientNetwork)) {
    return "TRANSIENT_NETWORK";
  }

  if (includesAny(text, rules.keywords.targetIssue)) {
    return "TARGET_ISSUE";
  }

  if (includesAny(text, rules.keywords.contentIssue)) {
    return "CONTENT_ISSUE";
  }

  return "UNKNOWN_FAILURE";
}
