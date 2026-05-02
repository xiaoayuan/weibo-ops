import { z } from "zod";

import { prisma } from "@/src/lib/prisma";

const settingKey = "risk_rules_v1";

const keywordsSchema = z.object({
  targetIssue: z.array(z.string().trim().min(1)).min(1),
  contentIssue: z.array(z.string().trim().min(1)).min(1),
  transientNetwork: z.array(z.string().trim().min(1)).min(1),
  platformBusy: z.array(z.string().trim().min(1)).min(1),
  accountRisk: z.array(z.string().trim().min(1)).min(1),
});

const scoreSchema = z.object({
  success: z.number().int().min(-5).max(0),
  targetIssue: z.number().int().min(0).max(5),
  contentIssue: z.number().int().min(0).max(5),
  transientNetwork: z.number().int().min(0).max(5),
  platformBusy: z.number().int().min(0).max(5),
  accountRisk: z.number().int().min(0).max(10),
  unknownFailure: z.number().int().min(0).max(5),
});

const thresholdSchema = z.object({
  markRiskyAt: z.number().int().min(1).max(20),
  recoverActiveAt: z.number().int().min(0).max(20),
  maxRiskLevel: z.number().int().min(5).max(50),
});

export const riskRulesSchema = z
  .object({ keywords: keywordsSchema, score: scoreSchema, threshold: thresholdSchema })
  .refine((value) => value.threshold.recoverActiveAt < value.threshold.markRiskyAt, {
    message: "recoverActiveAt 必须小于 markRiskyAt",
    path: ["threshold", "recoverActiveAt"],
  });

export type RiskRules = z.infer<typeof riskRulesSchema>;

export const defaultRiskRules: RiskRules = {
  keywords: {
    targetIssue: ["未找到可用的 0 回复帖子", "没搜到首评", "目标不存在", "链接失效", "已大于20条", "评论数已大于20条", "找不到微博", "status not found", "target not found", "not found", "deleted", "已删除"],
    contentIssue: ["文案", "模板", "内容为空", "content missing", "template"],
    transientNetwork: ["timeout", "timed out", "etimedout", "econnreset", "econnrefused", "network", "socket hang up", "代理", "proxy", "连接失败"],
    platformBusy: ["系统繁忙", "稍后再试", "busy", "please try again", "100001"],
    accountRisk: ["cookie", "登录失效", "请先登录", "账号异常", "行为异常", "频率限制", "访问受限", "验证码", "风控", "账号受限", "invalid session", "login required", "risk", "rate limit", "forbidden", "unauthorized"],
  },
  score: { success: -1, targetIssue: 0, contentIssue: 0, transientNetwork: 1, platformBusy: 1, accountRisk: 3, unknownFailure: 1 },
  threshold: { markRiskyAt: 8, recoverActiveAt: 3, maxRiskLevel: 20 },
};

let cachedRules: RiskRules | null = null;
let cachedAt = 0;

function normalizeKeywords(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim().toLowerCase()).filter(Boolean)));
}

function normalizeRules(rules: RiskRules): RiskRules {
  return {
    ...rules,
    keywords: {
      targetIssue: normalizeKeywords(rules.keywords.targetIssue),
      contentIssue: normalizeKeywords(rules.keywords.contentIssue),
      transientNetwork: normalizeKeywords(rules.keywords.transientNetwork),
      platformBusy: normalizeKeywords(rules.keywords.platformBusy),
      accountRisk: normalizeKeywords(rules.keywords.accountRisk),
    },
  };
}

export async function getRiskRules() {
  const now = Date.now();
  if (cachedRules && now - cachedAt < 60_000) {
    return cachedRules;
  }

  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: settingKey } });
    if (!setting) {
      cachedRules = normalizeRules(defaultRiskRules);
      cachedAt = now;
      return cachedRules;
    }

    const parsed = riskRulesSchema.safeParse(setting.value);
    if (!parsed.success) {
      cachedRules = normalizeRules(defaultRiskRules);
      cachedAt = now;
      return cachedRules;
    }

    cachedRules = normalizeRules(parsed.data);
    cachedAt = now;
    return cachedRules;
  } catch {
    cachedRules = normalizeRules(defaultRiskRules);
    cachedAt = now;
    return cachedRules;
  }
}

export async function saveRiskRules(nextRules: RiskRules) {
  const normalized = normalizeRules(nextRules);
  await prisma.systemSetting.upsert({
    where: { key: settingKey },
    create: { key: settingKey, value: normalized },
    update: { value: normalized },
  });
  cachedRules = normalized;
  cachedAt = Date.now();
  return normalized;
}
