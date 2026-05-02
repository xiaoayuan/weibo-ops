export type AiBusinessType = "DAILY_PLAN" | "QUICK_REPLY" | "COMMENT_CONTROL" | "REPOST_ROTATION";
export type AiTone = "NATURAL" | "PASSERBY" | "SUPPORTIVE" | "DISCUSSIVE" | "LIVELY";
export type AiLength = "SHORT" | "STANDARD" | "LONG";
export type AiCount = 10 | 20 | 50;

export type AiCandidate = {
  title: string;
  content: string;
};

export type AiGenerateResult = {
  batchId: string;
  candidates: AiCandidate[];
};

export type LinkPreview = {
  summary?: string;
  content?: string;
};

export type AiRiskAssessment = {
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  reasons: string[];
  suggestions: string[];
  canBlock: boolean;
};

export type AiSaveItem = {
  title: string;
  content: string;
  tags: string[];
  status: "ACTIVE" | "DISABLED";
};

export type FormState = {
  title: string;
  content: string;
  tags: string;
  firstComment: boolean;
  status: "ACTIVE" | "DISABLED";
};

export const AI_BUSINESS_TYPE_TEXT: Record<AiBusinessType, string> = {
  DAILY_PLAN: "每日计划",
  QUICK_REPLY: "一键回复",
  COMMENT_CONTROL: "控评",
  REPOST_ROTATION: "轮转",
};

export const AI_TONE_TEXT: Record<AiTone, string> = {
  NATURAL: "自然",
  PASSERBY: "路人",
  SUPPORTIVE: "支持",
  DISCUSSIVE: "讨论",
  LIVELY: "活泼",
};

export const AI_LENGTH_TEXT: Record<AiLength, string> = {
  SHORT: "短句",
  STANDARD: "标准",
  LONG: "略长",
};

export const AI_COUNT_OPTIONS: AiCount[] = [10, 20, 50];

export const initialForm: FormState = {
  title: "",
  content: "",
  tags: "",
  firstComment: false,
  status: "ACTIVE",
};
