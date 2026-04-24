import { z } from "zod";

const urgencySchema = z.enum(["S", "A", "B"]);

const forecastSchema = z.object({
  targetMinutes: z.number().int().min(1).max(24 * 60),
  limitMinutes: z.number().int().min(1).max(24 * 60),
  riskLevel: z.enum(["low", "medium", "high"]),
  notes: z.array(z.string().trim().min(1).max(200)).max(10),
});

const aiRiskSchema = z.object({
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  summary: z.string().trim().min(1).max(300),
  reasons: z.array(z.string().trim().min(1).max(300)).max(10),
  suggestions: z.array(z.string().trim().min(1).max(300)).max(10),
  canBlock: z.boolean(),
});

export const createCommentPoolItemSchema = z.object({
  sourceUrl: z.string().url("请填写有效链接"),
  note: z.string().trim().max(80, "备注不能超过 80 字").optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  forceDuplicate: z.boolean().optional(),
});

export const batchImportCommentPoolSchema = z.object({
  sourceUrls: z.array(z.string().url("包含无效链接")).min(1, "至少导入一条链接"),
  note: z.string().trim().max(80, "备注不能超过 80 字").optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  forceDuplicate: z.boolean().default(false),
});

export const startCommentLikeJobSchema = z.object({
  accountIds: z.array(z.string().min(1)).min(1, "至少选择一个账号"),
  poolItemIds: z.array(z.string().min(1)).min(1, "至少选择一条评论链接"),
  urgency: urgencySchema.default("S").optional(),
  forecast: forecastSchema.optional(),
  aiRisk: aiRiskSchema.optional(),
});

export const startRepostRotationJobSchema = z.object({
  accountIds: z.array(z.string().min(1)).min(1, "至少选择一个账号"),
  targetUrl: z.string().url("请填写有效微博链接"),
  times: z.number().int().min(1).max(20).default(5),
  intervalSec: z.union([z.literal(0), z.literal(3), z.literal(5), z.literal(10)]).default(3),
  copywritingTexts: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  urgency: urgencySchema.default("A").optional(),
  forecast: forecastSchema.optional(),
  aiRisk: aiRiskSchema.optional(),
});
