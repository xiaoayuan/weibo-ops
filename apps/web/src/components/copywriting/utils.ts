import type { CopywritingTemplate } from "@/lib/app-data";
import type { AiBusinessType } from "./types";

export function isAiCopywriting(item: CopywritingTemplate) {
  return item.tags.includes("AI生成");
}

export function getCopywritingSourceText(item: CopywritingTemplate) {
  return isAiCopywriting(item) ? "AI" : "手动";
}

export function getBusinessTypeFromTags(item: CopywritingTemplate): "ALL" | AiBusinessType {
  if (item.tags.includes("业务:每日计划")) {
    return "DAILY_PLAN";
  }
  if (item.tags.includes("业务:一键回复")) {
    return "QUICK_REPLY";
  }
  if (item.tags.includes("业务:控评")) {
    return "COMMENT_CONTROL";
  }
  if (item.tags.includes("业务:轮转")) {
    return "REPOST_ROTATION";
  }

  return "ALL";
}

export function getRiskLevelColor(level: "LOW" | "MEDIUM" | "HIGH") {
  if (level === "LOW") return "success";
  if (level === "MEDIUM") return "warning";
  return "danger";
}

export function getRiskLevelText(level: "LOW" | "MEDIUM" | "HIGH") {
  if (level === "LOW") return "低风险";
  if (level === "MEDIUM") return "中风险";
  return "高风险";
}

type ApiEnvelope<T> = { success: boolean; message?: string; data?: T };

export function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return typeof value === "object" && value !== null && "success" in value;
}

export function getApiMessage(value: unknown) {
  return isApiEnvelope(value) && typeof value.message === "string" ? value.message : null;
}
