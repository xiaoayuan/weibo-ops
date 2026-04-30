import { z } from "zod";

const aiBusinessTypeSchema = z.enum(["DAILY_PLAN", "QUICK_REPLY", "COMMENT_CONTROL", "REPOST_ROTATION"]);
const aiToneSchema = z.enum(["NATURAL", "PASSERBY", "SUPPORTIVE", "DISCUSSIVE", "LIVELY"]);
const aiLengthSchema = z.enum(["SHORT", "STANDARD", "LONG"]);
const aiRiskAssessmentSchema = z.object({
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  summary: z.string().min(1).max(300),
  reasons: z.array(z.string().min(1).max(300)).max(10),
  suggestions: z.array(z.string().min(1).max(300)).max(10),
  canBlock: z.boolean(),
});

export const createCopywritingSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(100, "标题过长"),
  content: z.string().min(1, "文案内容不能为空").max(500, "文案内容过长"),
  tags: z.array(z.string().min(1).max(20)).default([]),
  status: z.enum(["ACTIVE", "DISABLED"]).default("ACTIVE"),
});

export const generateAiCopywritingSchema = z.object({
  businessType: aiBusinessTypeSchema,
  context: z.string().trim().min(5, "请填写更具体的主题或上下文").max(1000, "上下文过长"),
  tone: aiToneSchema,
  count: z.union([z.literal(10), z.literal(20), z.literal(50)]),
  length: aiLengthSchema,
  constraints: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
});

export const saveAiCopywritingSchema = z.object({
  batchId: z.string().min(1),
  businessType: aiBusinessTypeSchema,
  tone: aiToneSchema,
  length: aiLengthSchema,
  constraints: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
  items: z.array(createCopywritingSchema).min(1, "至少选择一条文案").max(100),
  riskAssessments: z.array(aiRiskAssessmentSchema).max(100).optional(),
});

export const rewriteAiCopywritingSchema = z.object({
  sourceContent: z.string().trim().min(1, "原文案不能为空").max(500, "原文案过长"),
  businessType: aiBusinessTypeSchema,
  context: z.string().trim().max(1000, "上下文过长").default(""),
  tone: aiToneSchema,
  count: z.union([z.literal(10), z.literal(20), z.literal(50)]),
  length: aiLengthSchema,
  constraints: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
});

const allowedWeiboHosts = new Set(["weibo.com", "www.weibo.com", "m.weibo.cn", "weibo.cn"]);
const allowedAiHosts = new Set(["api.openai.com"]);

function getValidatedUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isAllowedWeiboUrl(value: string) {
  const url = getValidatedUrl(value);
  return Boolean(url && ["http:", "https:"].includes(url.protocol) && allowedWeiboHosts.has(url.hostname.toLowerCase()));
}

function isAllowedAiUrl(value: string) {
  const url = getValidatedUrl(value);
  return Boolean(url && url.protocol === "https:" && allowedAiHosts.has(url.hostname.toLowerCase()));
}

export const saveAiConfigSchema = z.object({
  baseUrl: z.string().url("请填写有效的 AI 接口地址").refine(isAllowedAiUrl, "AI 接口地址仅允许使用 OpenAI 官方 HTTPS 接口"),
  model: z.string().trim().min(1, "模型不能为空").max(100, "模型名称过长"),
  apiKey: z.string().trim().max(500, "API Key 过长").optional().or(z.literal("")),
});

export const fetchCopywritingLinkPreviewSchema = z.object({
  targetUrl: z.string().url("请填写有效微博链接").refine(isAllowedWeiboUrl, "仅支持预览微博域名链接"),
});
