import { prisma } from "@/lib/prisma";

const settingKey = "ai_risk_config_v1";

export type AiRiskConfig = {
  riskyKeywords: string[];
};

export const defaultAiRiskConfig: AiRiskConfig = {
  riskyKeywords: ["加微信", "私信我", "vx", "稳赚", "返现", "优惠", "下单", "冲冲冲", "速来", "置顶"],
};

let cachedConfig: AiRiskConfig | null = null;
let cachedAt = 0;

function normalizeKeywords(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function normalizeConfig(config: AiRiskConfig): AiRiskConfig {
  return {
    riskyKeywords: normalizeKeywords(config.riskyKeywords),
  };
}

export async function getAiRiskConfig() {
  const now = Date.now();
  if (cachedConfig && now - cachedAt < 60_000) {
    return cachedConfig;
  }

  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: settingKey } });
    const value = setting?.value;

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      cachedConfig = normalizeConfig(defaultAiRiskConfig);
      cachedAt = now;
      return cachedConfig;
    }

    const riskyKeywords = Array.isArray((value as Record<string, unknown>).riskyKeywords)
      ? ((value as Record<string, unknown>).riskyKeywords as unknown[]).filter((item): item is string => typeof item === "string")
      : defaultAiRiskConfig.riskyKeywords;

    cachedConfig = normalizeConfig({ riskyKeywords });
    cachedAt = now;
    return cachedConfig;
  } catch {
    cachedConfig = normalizeConfig(defaultAiRiskConfig);
    cachedAt = now;
    return cachedConfig;
  }
}

export async function saveAiRiskConfig(input: AiRiskConfig) {
  const normalized = normalizeConfig(input);

  await prisma.systemSetting.upsert({
    where: { key: settingKey },
    create: { key: settingKey, value: normalized as never },
    update: { value: normalized as never },
  });

  cachedConfig = normalized;
  cachedAt = Date.now();
  return normalized;
}
