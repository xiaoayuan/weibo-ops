import { randomUUID } from "crypto";

export type AiCopywritingBusinessType = "DAILY_PLAN" | "QUICK_REPLY" | "COMMENT_CONTROL" | "REPOST_ROTATION";
export type AiCopywritingTone = "NATURAL" | "PASSERBY" | "SUPPORTIVE" | "DISCUSSIVE" | "LIVELY";
export type AiCopywritingLength = "SHORT" | "STANDARD" | "LONG";

export type AiCopywritingGenerateInput = {
  businessType: AiCopywritingBusinessType;
  context: string;
  tone: AiCopywritingTone;
  count: number;
  length: AiCopywritingLength;
  constraints: string[];
};

export type AiCopywritingCandidate = {
  title: string;
  content: string;
};

export const businessTypeText: Record<AiCopywritingBusinessType, string> = {
  DAILY_PLAN: "每日计划",
  QUICK_REPLY: "一键回复",
  COMMENT_CONTROL: "控评",
  REPOST_ROTATION: "轮转",
};

export const toneText: Record<AiCopywritingTone, string> = {
  NATURAL: "自然",
  PASSERBY: "路人",
  SUPPORTIVE: "支持",
  DISCUSSIVE: "讨论",
  LIVELY: "活泼",
};

export const lengthText: Record<AiCopywritingLength, string> = {
  SHORT: "短句",
  STANDARD: "标准",
  LONG: "略长",
};

function buildPrompt(input: AiCopywritingGenerateInput) {
  const constraints = input.constraints.length > 0 ? input.constraints.join("、") : "无额外限制";

  return [
    `你是微博运营文案助手。请生成 ${input.count} 条中文短文案。`,
    `业务类型：${businessTypeText[input.businessType]}`,
    `主题或上下文：${input.context}`,
    `语气：${toneText[input.tone]}`,
    `长度偏好：${lengthText[input.length]}`,
    `额外限制：${constraints}`,
    "要求：",
    "1. 更像真人说话，不要像客服和营销文案。",
    "2. 每条都要有明显差异，不要只改几个字。",
    "3. 不要编号，不要解释，不要标题，只输出纯文案。",
    "4. 避免过度夸张、机械重复、空泛套话。",
    "5. 每行一条。",
  ].join("\n");
}

function buildRewritePrompt(input: AiCopywritingGenerateInput & { sourceContent: string }) {
  const constraints = input.constraints.length > 0 ? input.constraints.join("、") : "无额外限制";

  return [
    `请基于下面这条原文案，改写出 ${input.count} 条新的中文短文案。`,
    `业务类型：${businessTypeText[input.businessType]}`,
    `原文案：${input.sourceContent}`,
    `补充上下文：${input.context || "无"}`,
    `语气：${toneText[input.tone]}`,
    `长度偏好：${lengthText[input.length]}`,
    `额外限制：${constraints}`,
    "要求：",
    "1. 保留核心意思，但表达方式明显不同。",
    "2. 更像真人说话，不要像客服和营销文案。",
    "3. 不要编号，不要解释，不要标题，只输出纯文案。",
    "4. 每行一条。",
  ].join("\n");
}

function normalizeContentLines(raw: string, maxCount: number) {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const line of raw.split(/\n+/)) {
    const normalized = line.replace(/^[\d\-\*\.、\s]+/, "").trim();

    if (!normalized || normalized.length > 200 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    items.push(normalized);

    if (items.length >= maxCount) {
      break;
    }
  }

  return items;
}

function buildTitle(input: AiCopywritingGenerateInput, index: number) {
  return `${businessTypeText[input.businessType]}-${toneText[input.tone]}-${lengthText[input.length]}-${index + 1}`;
}

export function buildAiCopywritingTags(input: AiCopywritingGenerateInput, batchId: string) {
  return [
    "AI生成",
    `业务:${businessTypeText[input.businessType]}`,
    `语气:${toneText[input.tone]}`,
    `长度:${lengthText[input.length]}`,
    `批次:${batchId}`,
  ];
}

export function readAiBusinessTypeFromTags(tags: string[]): AiCopywritingBusinessType | null {
  if (tags.includes(`业务:${businessTypeText.DAILY_PLAN}`)) {
    return "DAILY_PLAN";
  }
  if (tags.includes(`业务:${businessTypeText.QUICK_REPLY}`)) {
    return "QUICK_REPLY";
  }
  if (tags.includes(`业务:${businessTypeText.COMMENT_CONTROL}`)) {
    return "COMMENT_CONTROL";
  }
  if (tags.includes(`业务:${businessTypeText.REPOST_ROTATION}`)) {
    return "REPOST_ROTATION";
  }

  return null;
}

async function requestAiText(prompt: string) {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || "gpt-4.1-mini";
  const baseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1/chat/completions";

  if (!apiKey) {
    throw new Error("AI_API_KEY 未配置");
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      messages: [
        {
          role: "system",
          content: "你擅长写适合微博运营场景的真实中文短文案。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI 服务请求失败：${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("AI 未返回可用文案");
  }

  return content;
}

export function isAiCopywriting(tags: string[]) {
  return tags.includes("AI生成");
}

export async function generateAiCopywriting(input: AiCopywritingGenerateInput) {
  const content = await requestAiText(buildPrompt(input));

  const lines = normalizeContentLines(content, input.count);

  if (lines.length === 0) {
    throw new Error("AI 返回内容清洗后为空");
  }

  return {
    batchId: randomUUID(),
    candidates: lines.map((item, index) => ({
      title: buildTitle(input, index),
      content: item,
    })) satisfies AiCopywritingCandidate[],
  };
}

export async function rewriteAiCopywriting(input: AiCopywritingGenerateInput & { sourceContent: string }) {
  const content = await requestAiText(buildRewritePrompt(input));
  const lines = normalizeContentLines(content, input.count);

  if (lines.length === 0) {
    throw new Error("AI 改写结果清洗后为空");
  }

  return {
    batchId: randomUUID(),
    candidates: lines.map((item, index) => ({
      title: `${businessTypeText[input.businessType]}-改写-${index + 1}`,
      content: item,
    })) satisfies AiCopywritingCandidate[],
  };
}
