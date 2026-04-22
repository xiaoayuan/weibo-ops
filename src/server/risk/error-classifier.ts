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

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

export function classifyExecutionOutcome(input: ClassifyInput, rules: RiskRules): ExecutionErrorClass {
  if (input.success) {
    return "SUCCESS";
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
