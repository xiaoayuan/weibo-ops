import { resolveAiRuntimeConfig } from "@/server/copywriting/ai-config";

export type AiRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type AiRiskAssessment = {
  riskLevel: AiRiskLevel;
  summary: string;
  reasons: string[];
  suggestions: string[];
  canBlock: boolean;
};

const riskyKeywords = ["加微信", "私信我", "vx", "稳赚", "返现", "优惠", "下单", "冲冲冲", "速来", "置顶"];

function stripCodeFences(text: string) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
}

async function requestAiRisk(prompt: string) {
  const { apiKey, model, baseUrl } = await resolveAiRuntimeConfig();

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
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "你是微博运营风控助手。请只输出 JSON，格式为 { riskLevel, summary, reasons, suggestions }，其中 riskLevel 只能是 LOW、MEDIUM、HIGH。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI 风控请求失败：${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("AI 风控未返回可用内容");
  }

  return JSON.parse(stripCodeFences(content)) as {
    riskLevel?: AiRiskLevel;
    summary?: string;
    reasons?: string[];
    suggestions?: string[];
  };
}

function normalizeAssessment(input: Partial<AiRiskAssessment>, canBlock: boolean): AiRiskAssessment {
  return {
    riskLevel: input.riskLevel || "LOW",
    summary: input.summary || "未发现明显风险",
    reasons: input.reasons && input.reasons.length > 0 ? input.reasons : ["未命中明显风险点"],
    suggestions: input.suggestions && input.suggestions.length > 0 ? input.suggestions : ["保持当前策略即可"],
    canBlock,
  };
}

function assessCopywritingFallback(content: string, peerContents: string[], canBlock = true): AiRiskAssessment {
  const reasons: string[] = [];
  const suggestions: string[] = [];
  let riskLevel: AiRiskLevel = "LOW";
  const normalized = content.replace(/\s+/g, "").trim();
  const hasRiskKeyword = riskyKeywords.filter((keyword) => content.includes(keyword));
  const duplicateLike = peerContents.some((item) => item !== content && item.replace(/\s+/g, "").trim() === normalized);

  if (hasRiskKeyword.length > 0) {
    riskLevel = "HIGH";
    reasons.push(`命中风险词：${hasRiskKeyword.join(" / ")}`);
    suggestions.push("建议删除营销/引导性质表达后再使用");
  }

  if (duplicateLike) {
    riskLevel = riskLevel === "HIGH" ? "HIGH" : "MEDIUM";
    reasons.push("与同批文案高度重复");
    suggestions.push("建议改写出更明显差异后再保存");
  }

  if (content.length < 6) {
    riskLevel = riskLevel === "HIGH" ? "HIGH" : "MEDIUM";
    reasons.push("文案过短，容易模板化");
    suggestions.push("建议补充更多自然表达细节");
  }

  return normalizeAssessment(
    {
      riskLevel,
      summary: reasons.length > 0 ? reasons[0] : "文案整体较自然",
      reasons,
      suggestions,
    },
    canBlock,
  );
}

export async function assessCopywritingCandidates(input: {
  businessType: string;
  context: string;
  candidates: string[];
}) {
  const prompt = [
    `业务类型：${input.businessType}`,
    `上下文：${input.context || "无"}`,
    "请分别评估以下候选文案的风险，返回 JSON 数组，每项包含 riskLevel、summary、reasons、suggestions。",
    ...input.candidates.map((item, index) => `${index + 1}. ${item}`),
  ].join("\n");

  try {
    const result = await requestAiRisk(prompt);
    const list = Array.isArray((result as unknown as { items?: unknown[] }).items)
      ? ((result as unknown as { items: Partial<AiRiskAssessment>[] }).items || [])
      : [];

    if (list.length === input.candidates.length) {
      return list.map((item) => normalizeAssessment(item, true));
    }
  } catch {
    // fall back to local heuristics
  }

  return input.candidates.map((content) => assessCopywritingFallback(content, input.candidates, true));
}

export async function assessTaskRisk(input: {
  taskType: string;
  urgency: string;
  accountCount: number;
  context?: string;
}) {
  const prompt = [
    `任务类型：${input.taskType}`,
    `时效等级：${input.urgency}`,
    `账号数量：${input.accountCount}`,
    `上下文：${input.context || "无"}`,
    "请评估这次任务的整体运营风险，返回 JSON。",
  ].join("\n");

  try {
    return normalizeAssessment(await requestAiRisk(prompt), false);
  } catch {
    const reasons: string[] = [];
    const suggestions: string[] = [];
    let riskLevel: AiRiskLevel = input.urgency === "S" ? "MEDIUM" : "LOW";

    if (input.accountCount >= 8) {
      riskLevel = "HIGH";
      reasons.push("账号数量较多，集中动作风险升高");
      suggestions.push("建议拉长执行窗口或降低时效等级");
    }

    if (input.urgency === "S") {
      reasons.push("高时效任务更容易形成集中爆发");
      suggestions.push("建议仅在确有时效要求时使用 S 级");
    }

    return normalizeAssessment({ riskLevel, summary: reasons[0], reasons, suggestions }, false);
  }
}

export async function summarizeFailureRisk(input: {
  actionText: string;
  detailText: string;
  topReason?: string | null;
}) {
  const prompt = [
    `动作：${input.actionText}`,
    `详情：${input.detailText}`,
    `主要原因：${input.topReason || "无"}`,
    "请判断这次失败更像账号问题、文案问题、目标内容问题还是平台问题，并给出简短建议，返回 JSON。",
  ].join("\n");

  try {
    return normalizeAssessment(await requestAiRisk(prompt), false);
  } catch {
    const reason = input.topReason || input.detailText || "失败原因待确认";
    const normalized = reason.toLowerCase();
    let summary = "更像平台或网络问题";
    if (normalized.includes("登录") || normalized.includes("cookie") || normalized.includes("账号")) {
      summary = "更像账号状态问题";
    } else if (normalized.includes("未找到") || normalized.includes("目标") || normalized.includes("链接")) {
      summary = "更像目标内容问题";
    } else if (normalized.includes("文案") || normalized.includes("内容")) {
      summary = "更像文案内容问题";
    }

    return normalizeAssessment(
      {
        riskLevel: "MEDIUM",
        summary,
        reasons: [reason],
        suggestions: ["建议结合执行日志和账号状态继续排查"],
      },
      false,
    );
  }
}
