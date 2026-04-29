// 共享类型定义，替代 ops-manager.tsx 和 ai-risk.ts 中的重复定义

export type AiRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type AiRiskAssessment = {
  riskLevel: AiRiskLevel;
  summary: string;
  reasons: string[];
  suggestions: string[];
  canBlock: boolean;
};

export type JobForecast = {
  targetMinutes: number;
  limitMinutes: number;
  riskLevel: "low" | "medium" | "high";
  notes: string[];
};

export type JobConfig = {
  urgency?: "S" | "A" | "B";
  forecast?: JobForecast;
  aiRisk?: AiRiskAssessment | null;
};

export type JobSummary = {
  stoppedBy?: string;
  stoppedAt?: string;
  totalAccounts?: number;
  successAccounts?: number;
  failedAccounts?: number;
  partialAccounts?: number;
  targetUrl?: string;
  times?: number;
  intervalSec?: number;
  urgency?: "S" | "A" | "B";
  scheduleDecision?: {
    effectiveTier?: "S" | "A" | "B";
    delayMs?: number;
    reasons?: string[];
  };
};
