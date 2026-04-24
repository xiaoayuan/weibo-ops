import { decryptText, encryptText } from "@/lib/encrypt";
import { prisma } from "@/lib/prisma";

const settingKey = "ai_copywriting_config_v1";

type StoredAiConfig = {
  baseUrl?: string;
  model?: string;
  apiKeyEncrypted?: string;
};

export type AiCopywritingConfig = {
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  apiKeySource: "system" | "env" | "none";
};

function getDefaultBaseUrl() {
  return process.env.AI_BASE_URL || "https://api.openai.com/v1/chat/completions";
}

function getDefaultModel() {
  return process.env.AI_MODEL || "gpt-4.1-mini";
}

async function getStoredConfig() {
  const setting = await prisma.systemSetting.findUnique({ where: { key: settingKey }, select: { value: true } });

  if (!setting?.value || typeof setting.value !== "object" || Array.isArray(setting.value)) {
    return null;
  }

  return setting.value as StoredAiConfig;
}

export async function getAiCopywritingConfig(): Promise<AiCopywritingConfig> {
  const stored = await getStoredConfig();
  const envApiKey = process.env.AI_API_KEY;

  return {
    baseUrl: stored?.baseUrl || getDefaultBaseUrl(),
    model: stored?.model || getDefaultModel(),
    hasApiKey: Boolean(stored?.apiKeyEncrypted || envApiKey),
    apiKeySource: stored?.apiKeyEncrypted ? "system" : envApiKey ? "env" : "none",
  };
}

export async function resolveAiRuntimeConfig() {
  const stored = await getStoredConfig();
  const apiKey = stored?.apiKeyEncrypted ? decryptText(stored.apiKeyEncrypted) : process.env.AI_API_KEY || "";

  return {
    baseUrl: stored?.baseUrl || getDefaultBaseUrl(),
    model: stored?.model || getDefaultModel(),
    apiKey,
  };
}

export async function saveAiCopywritingConfig(input: { baseUrl: string; model: string; apiKey?: string }) {
  const current = (await getStoredConfig()) || {};
  const nextValue: StoredAiConfig = {
    baseUrl: input.baseUrl,
    model: input.model,
    apiKeyEncrypted: input.apiKey ? encryptText(input.apiKey) : current.apiKeyEncrypted,
  };

  await prisma.systemSetting.upsert({
    where: { key: settingKey },
    create: { key: settingKey, value: nextValue as never },
    update: { value: nextValue as never },
  });

  return getAiCopywritingConfig();
}
