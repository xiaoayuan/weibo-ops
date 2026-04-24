"use client";

import type { CopywritingTemplate } from "@/generated/prisma/client";
import { canManageBusinessData } from "@/lib/permission-rules";
import type { AppRole } from "@/lib/permission-rules";
import { FormEvent, useState } from "react";

type AiBusinessType = "DAILY_PLAN" | "QUICK_REPLY" | "COMMENT_CONTROL" | "REPOST_ROTATION";
type AiTone = "NATURAL" | "PASSERBY" | "SUPPORTIVE" | "DISCUSSIVE" | "LIVELY";
type AiLength = "SHORT" | "STANDARD" | "LONG";

type AiFormState = {
  businessType: AiBusinessType;
  context: string;
  tone: AiTone;
  count: 10 | 20 | 50;
  length: AiLength;
  constraints: string[];
};

type AiCandidate = {
  title: string;
  content: string;
};

type AiConfigState = {
  baseUrl: string;
  model: string;
  apiKey: string;
  hasApiKey: boolean;
  apiKeySource: "system" | "env" | "none";
};

type LinkPreview = {
  title: string;
  content: string;
  finalUrl: string;
  suggestedBusinessType: AiBusinessType;
  suggestedTone: AiTone;
  recommendedContext: string;
};

type AiRiskAssessment = {
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  reasons: string[];
  suggestions: string[];
  canBlock: boolean;
};

type FormState = {
  title: string;
  content: string;
  tags: string;
  firstComment: boolean;
  status: "ACTIVE" | "DISABLED";
};

const initialForm: FormState = {
  title: "",
  content: "",
  tags: "",
  firstComment: false,
  status: "ACTIVE",
};

const initialAiForm: AiFormState = {
  businessType: "QUICK_REPLY",
  context: "",
  tone: "NATURAL",
  count: 10,
  length: "STANDARD",
  constraints: [],
};

const aiConstraintOptions = ["避免营销感", "避免重复开头", "不要表情", "更像真人评论"] as const;

const businessTypeText: Record<AiBusinessType, string> = {
  DAILY_PLAN: "每日计划",
  QUICK_REPLY: "一键回复",
  COMMENT_CONTROL: "控评",
  REPOST_ROTATION: "轮转",
};

const toneText: Record<AiTone, string> = {
  NATURAL: "自然",
  PASSERBY: "路人",
  SUPPORTIVE: "支持",
  DISCUSSIVE: "讨论",
  LIVELY: "活泼",
};

function normalizeCandidateText(text: string) {
  return text.replace(/[\s，。！？!?,.;；:“”"'`~～【】\[\]()（）]/g, "").trim();
}

function getSimilarityRatio(left: string, right: string) {
  if (!left || !right) {
    return 0;
  }

  const source = new Set(left.split(""));
  const target = new Set(right.split(""));
  let overlap = 0;

  for (const char of source) {
    if (target.has(char)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(source.size, target.size, 1);
}

function analyzeCandidate(content: string, allContents: string[], riskKeywords: string[]) {
  const normalized = normalizeCandidateText(content);
  const duplicateLike = allContents.some((item) => item !== content && getSimilarityRatio(normalized, normalizeCandidateText(item)) >= 0.8);
  const matchedKeywords = riskKeywords.filter((keyword) => content.includes(keyword));

  return {
    duplicateLike,
    matchedKeywords,
  };
}

function readBusinessTypeFromTags(item: CopywritingTemplate): AiBusinessType | "ALL" {
  if (item.tags.includes(`业务:${businessTypeText.DAILY_PLAN}`)) {
    return "DAILY_PLAN";
  }
  if (item.tags.includes(`业务:${businessTypeText.QUICK_REPLY}`)) {
    return "QUICK_REPLY";
  }
  if (item.tags.includes(`业务:${businessTypeText.COMMENT_CONTROL}`)) {
    return "COMMENT_CONTROL";
  }
  if (item.tags.includes(`业务:${businessTypeText.REPOST_ROTATION}`)) {
    return "REPOST_ROTATION";
  }

  return "ALL";
}

function isAiCopywriting(item: CopywritingTemplate) {
  return item.tags.includes("AI生成");
}

function getCopywritingSourceText(item: CopywritingTemplate) {
  return isAiCopywriting(item) ? "AI" : "手动";
}

export function CopywritingManager({
  currentUserRole,
  initialItems,
  initialAiConfig,
  initialAiRiskConfig,
}: {
  currentUserRole: AppRole;
  initialItems: CopywritingTemplate[];
  initialAiConfig: Omit<AiConfigState, "apiKey">;
  initialAiRiskConfig: { riskyKeywords: string[] };
}) {
  const [items, setItems] = useState(initialItems);
  const [form, setForm] = useState(initialForm);
  const [aiForm, setAiForm] = useState(initialAiForm);
  const [aiBatchId, setAiBatchId] = useState<string | null>(null);
  const [aiCandidates, setAiCandidates] = useState<AiCandidate[]>([]);
  const [aiCandidateRisks, setAiCandidateRisks] = useState<AiRiskAssessment[]>([]);
  const [selectedAiIndexes, setSelectedAiIndexes] = useState<number[]>([]);
  const [rewriteSource, setRewriteSource] = useState<CopywritingTemplate | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"ALL" | "MANUAL" | "AI">("ALL");
  const [businessFilter, setBusinessFilter] = useState<"ALL" | AiBusinessType>("ALL");
  const [aiConfig, setAiConfig] = useState<AiConfigState>({ ...initialAiConfig, apiKey: "" });
  const [aiRiskKeywordsText, setAiRiskKeywordsText] = useState(initialAiRiskConfig.riskyKeywords.join("\n"));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiRewriting, setAiRewriting] = useState(false);
  const [aiConfigSaving, setAiConfigSaving] = useState(false);
  const [aiRiskConfigSaving, setAiRiskConfigSaving] = useState(false);
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = canManageBusinessData(currentUserRole);

  const filteredItems = items.filter((item) => {
    const matchesSource = sourceFilter === "ALL" || (sourceFilter === "AI" ? isAiCopywriting(item) : !isAiCopywriting(item));
    const itemBusinessType = readBusinessTypeFromTags(item);
    const matchesBusiness = businessFilter === "ALL" || itemBusinessType === businessFilter;
    return matchesSource && matchesBusiness;
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(editingId ? `/api/copywriting/${editingId}` : "/api/copywriting", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          tags: Array.from(
            new Set([
              ...form.tags
                .split(",")
                .map((item) => item.trim())
                .filter((item) => Boolean(item) && item !== "首评文案" && item !== "FIRST_COMMENT"),
              ...(form.firstComment ? ["首评文案"] : []),
            ]),
          ),
          status: form.status,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "新增文案失败");
      }

      setItems((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? result.data : item))
          : [result.data, ...current],
      );
      setEditingId(null);
      setForm(initialForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId ? "更新文案失败" : "新增文案失败");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(item: CopywritingTemplate) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      content: item.content,
      tags: item.tags.join(", "),
      firstComment: item.tags.includes("首评文案") || item.tags.includes("FIRST_COMMENT"),
      status: item.status,
    });
    setError(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setError(null);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确认删除这条文案吗？")) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/copywriting/${id}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "删除文案失败");
      }

      setItems((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除文案失败");
    }
  }

  function toggleAiConstraint(value: string) {
    setAiForm((current) => ({
      ...current,
      constraints: current.constraints.includes(value) ? current.constraints.filter((item) => item !== value) : [...current.constraints, value],
    }));
  }

  function toggleAiCandidate(index: number) {
    setSelectedAiIndexes((current) => (current.includes(index) ? current.filter((item) => item !== index) : [...current, index]));
  }

  async function handleGenerateAi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setAiGenerating(true);
      setError(null);
      const response = await fetch("/api/copywriting/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiForm),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "AI 文案生成失败");
      }

      setAiBatchId(result.data.batchId);
      setAiCandidates(result.data.candidates);
      setSelectedAiIndexes(result.data.candidates.map((_: AiCandidate, index: number) => index));
      const riskResponse = await fetch("/api/ai-risk/copywriting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: aiForm.businessType,
          context: aiForm.context,
          candidates: result.data.candidates.map((item: AiCandidate) => item.content),
        }),
      });
      const riskResult = await riskResponse.json();
      setAiCandidateRisks(riskResponse.ok && riskResult.success ? riskResult.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 文案生成失败");
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleSaveAiCandidates() {
    const selectedItems = aiCandidates.filter((_, index) => selectedAiIndexes.includes(index));
    const selectedHighRisk = selectedAiIndexes.some((index) => aiCandidateRisks[index]?.riskLevel === "HIGH" && aiCandidateRisks[index]?.canBlock);

    if (!aiBatchId || selectedItems.length === 0) {
      setError("请先选择至少一条 AI 文案");
      return;
    }

    if (selectedHighRisk) {
      setError("当前选中的文案里包含 AI 判定为高风险的内容，请先取消勾选或改写后再保存");
      return;
    }

    try {
      setAiSaving(true);
      setError(null);
      const response = await fetch("/api/copywriting/ai-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: aiBatchId,
          businessType: aiForm.businessType,
          tone: aiForm.tone,
          length: aiForm.length,
          constraints: aiForm.constraints,
          riskAssessments: selectedAiIndexes.map((index) => aiCandidateRisks[index]).filter(Boolean),
          items: selectedItems.map((item) => ({
            title: item.title,
            content: item.content,
            tags: [],
            status: "ACTIVE",
          })),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "保存 AI 文案失败");
      }

      setItems((current) => [...result.data, ...current]);
      setAiBatchId(null);
      setAiCandidates([]);
      setAiCandidateRisks([]);
      setSelectedAiIndexes([]);
      setRewriteSource(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存 AI 文案失败");
    } finally {
      setAiSaving(false);
    }
  }

  async function handleRewriteAi(item: CopywritingTemplate) {
    try {
      setAiRewriting(true);
      setError(null);
      const businessType = readBusinessTypeFromTags(item);
      const response = await fetch("/api/copywriting/ai-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceContent: item.content,
          businessType: businessType === "ALL" ? aiForm.businessType : businessType,
          context: aiForm.context,
          tone: aiForm.tone,
          count: aiForm.count,
          length: aiForm.length,
          constraints: aiForm.constraints,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "AI 文案改写失败");
      }

      setRewriteSource(item);
      setAiBatchId(result.data.batchId);
      setAiCandidates(result.data.candidates);
      setSelectedAiIndexes(result.data.candidates.map((_: AiCandidate, index: number) => index));
      const riskResponse = await fetch("/api/ai-risk/copywriting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: businessType === "ALL" ? aiForm.businessType : businessType,
          context: aiForm.context,
          candidates: result.data.candidates.map((candidate: AiCandidate) => candidate.content),
        }),
      });
      const riskResult = await riskResponse.json();
      setAiCandidateRisks(riskResponse.ok && riskResult.success ? riskResult.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 文案改写失败");
    } finally {
      setAiRewriting(false);
    }
  }

  async function handleSaveAiConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setAiConfigSaving(true);
      setError(null);
      const response = await fetch("/api/copywriting/ai-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: aiConfig.baseUrl,
          model: aiConfig.model,
          apiKey: aiConfig.apiKey,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "保存 AI 接口配置失败");
      }

      setAiConfig({ ...result.data, apiKey: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存 AI 接口配置失败");
    } finally {
      setAiConfigSaving(false);
    }
  }

  async function handleSaveAiRiskConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setAiRiskConfigSaving(true);
      setError(null);
      const response = await fetch("/api/ai-risk/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riskyKeywords: aiRiskKeywordsText
            .split(/\n+/)
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "保存风险词配置失败");
      }

      setAiRiskKeywordsText(result.data.riskyKeywords.join("\n"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存风险词配置失败");
    } finally {
      setAiRiskConfigSaving(false);
    }
  }

  async function handleFetchLinkPreview() {
    try {
      setLinkPreviewLoading(true);
      setError(null);
      const response = await fetch("/api/copywriting/link-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: importUrl }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "链接内容预览失败");
      }

      setLinkPreview(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "链接内容预览失败");
    } finally {
      setLinkPreviewLoading(false);
    }
  }

  function applyPreviewToContext() {
    if (!linkPreview) {
      return;
    }

    setAiForm((current) => ({
      ...current,
      businessType: linkPreview.suggestedBusinessType,
      tone: linkPreview.suggestedTone,
      context: linkPreview.recommendedContext,
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">文案库</h2>
        <p className="mt-1 text-sm text-slate-500">维护互动文案、标签和启用状态。</p>
      </div>

      {canManage ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium">AI 接口配置</h3>
          <p className="mt-1 text-sm text-slate-500">在文案库页面直接配置 AI 接口。API Key 只会加密保存，不会明文回显。</p>
          <form className="mt-4 grid gap-4" onSubmit={handleSaveAiConfig}>
            <input
              value={aiConfig.baseUrl}
              onChange={(event) => setAiConfig((current) => ({ ...current, baseUrl: event.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              placeholder="AI Base URL"
            />
            <input
              value={aiConfig.model}
              onChange={(event) => setAiConfig((current) => ({ ...current, model: event.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              placeholder="模型名称"
            />
            <input
              type="password"
              value={aiConfig.apiKey}
              onChange={(event) => setAiConfig((current) => ({ ...current, apiKey: event.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              placeholder={aiConfig.hasApiKey ? "已配置 API Key，如需更换请重新输入" : "输入 AI API Key"}
            />
            <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>
                当前 Key 来源：{aiConfig.apiKeySource === "system" ? "页面配置" : aiConfig.apiKeySource === "env" ? ".env 环境变量" : "未配置"}
              </span>
              <button
                type="submit"
                disabled={aiConfigSaving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {aiConfigSaving ? "保存中..." : "保存 AI 配置"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {canManage ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium">{editingId ? "编辑文案" : "新增文案"}</h3>
          <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="文案标题"
          />
          <textarea
            value={form.content}
            onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
            className="min-h-28 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="文案内容"
          />
          <div className="grid gap-4 md:grid-cols-[1fr_180px]">
            <input
              value={form.tags}
              onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              placeholder="标签，逗号分隔"
            />
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value as FormState["status"] }))
              }
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="ACTIVE">启用</option>
              <option value="DISABLED">停用</option>
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.firstComment}
              onChange={(event) => setForm((current) => ({ ...current, firstComment: event.target.checked }))}
            />
            设为首评文案（自动打上标签 `首评文案`）
          </label>
          <div className="flex items-center justify-between gap-3">
            {error ? <p className="text-sm text-rose-600">{error}</p> : <div />}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "提交中..." : editingId ? "保存修改" : "新增文案"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  取消编辑
                </button>
              ) : null}
            </div>
          </div>
          </form>
        </section>
      ) : null}

      {canManage ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium">AI 生成文案</h3>
          <p className="mt-1 text-sm text-slate-500">AI 只生成候选文案，先预览再入库，不会直接执行任务。</p>
          <form className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleSaveAiRiskConfig}>
            <p className="text-sm font-medium text-slate-800">风险词词库</p>
            <p className="mt-1 text-xs text-slate-500">用于 AI 文案候选提示和 AI 风控助手兜底规则，修改后全局生效。</p>
            <textarea
              value={aiRiskKeywordsText}
              onChange={(event) => setAiRiskKeywordsText(event.target.value)}
              className="mt-3 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              placeholder="每行一个风险词"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={aiRiskConfigSaving}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {aiRiskConfigSaving ? "保存中..." : "保存风险词词库"}
              </button>
            </div>
          </form>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-800">导入微博链接</p>
            <p className="mt-1 text-xs text-slate-500">先抓取微博标题和正文摘要，确认后再填入上下文生成文案。</p>
            <div className="mt-3 flex flex-col gap-3 md:flex-row">
              <input
                value={importUrl}
                onChange={(event) => setImportUrl(event.target.value)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                placeholder="粘贴微博链接，例如 https://weibo.com/..."
              />
              <button
                type="button"
                onClick={handleFetchLinkPreview}
                disabled={linkPreviewLoading}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {linkPreviewLoading ? "抓取中..." : "预览内容"}
              </button>
            </div>
            {linkPreview ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-medium text-slate-900">{linkPreview.title}</p>
                <p className="mt-2 text-sm text-slate-600">{linkPreview.content}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">推荐业务：{businessTypeText[linkPreview.suggestedBusinessType]}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">推荐语气：{toneText[linkPreview.suggestedTone]}</span>
                </div>
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-medium text-slate-700">推荐上下文</p>
                  <p className="mt-2 whitespace-pre-wrap">{linkPreview.recommendedContext}</p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span className="truncate">来源：{linkPreview.finalUrl}</span>
                  <button type="button" onClick={applyPreviewToContext} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800">
                    应用推荐
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <form className="mt-4 grid gap-4" onSubmit={handleGenerateAi}>
            <select
              value={aiForm.businessType}
              onChange={(event) => setAiForm((current) => ({ ...current, businessType: event.target.value as AiBusinessType }))}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="DAILY_PLAN">每日计划</option>
              <option value="QUICK_REPLY">一键回复</option>
              <option value="COMMENT_CONTROL">控评</option>
              <option value="REPOST_ROTATION">轮转</option>
            </select>
            <textarea
              value={aiForm.context}
              onChange={(event) => setAiForm((current) => ({ ...current, context: event.target.value }))}
              className="min-h-28 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              placeholder="填写主题、微博内容、活动语境或你想要的表达方向"
            />
            <div className="grid gap-4 md:grid-cols-3">
              <select
                value={aiForm.tone}
                onChange={(event) => setAiForm((current) => ({ ...current, tone: event.target.value as AiTone }))}
                className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="NATURAL">自然</option>
                <option value="PASSERBY">路人</option>
                <option value="SUPPORTIVE">支持</option>
                <option value="DISCUSSIVE">讨论</option>
                <option value="LIVELY">活泼</option>
              </select>
              <select
                value={aiForm.count}
                onChange={(event) => setAiForm((current) => ({ ...current, count: Number(event.target.value) as 10 | 20 | 50 }))}
                className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              >
                <option value={10}>10 条</option>
                <option value={20}>20 条</option>
                <option value={50}>50 条</option>
              </select>
              <select
                value={aiForm.length}
                onChange={(event) => setAiForm((current) => ({ ...current, length: event.target.value as AiLength }))}
                className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="SHORT">短句</option>
                <option value="STANDARD">标准</option>
                <option value="LONG">略长</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-slate-700">
              {aiConstraintOptions.map((option) => (
                <label key={option} className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={aiForm.constraints.includes(option)} onChange={() => toggleAiConstraint(option)} />
                  {option}
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={aiGenerating}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {aiGenerating ? "生成中..." : "生成候选文案"}
              </button>
            </div>
          </form>

          {aiCandidates.length > 0 ? (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-medium">生成预览</h4>
                  {rewriteSource ? <p className="mt-1 text-xs text-slate-500">基于《{rewriteSource.title}》改写</p> : null}
                </div>
                <button
                  type="button"
                  onClick={handleSaveAiCandidates}
                  disabled={aiSaving}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {aiSaving ? "保存中..." : `保存选中 (${selectedAiIndexes.length})`}
                </button>
              </div>
              <div className="space-y-3">
                {aiCandidates.map((item, index) => {
                  const analysis = analyzeCandidate(
                    item.content,
                    aiCandidates.map((candidate) => candidate.content),
                    aiRiskKeywordsText
                      .split(/\n+/)
                      .map((keyword) => keyword.trim())
                      .filter(Boolean),
                  );
                  const risk = aiCandidateRisks[index];

                  return (
                    <label key={`${aiBatchId}-${index}`} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <input type="checkbox" checked={selectedAiIndexes.includes(index)} onChange={() => toggleAiCandidate(index)} className="mt-1" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900">{item.title}</span>
                        <span className="mt-2 block text-sm text-slate-600">{item.content}</span>
                        <span className="mt-3 flex flex-wrap gap-2 text-xs">
                          {risk ? <span className={`rounded-full px-2.5 py-1 ${risk.riskLevel === "HIGH" ? "border border-rose-200 bg-rose-50 text-rose-700" : risk.riskLevel === "MEDIUM" ? "border border-amber-200 bg-amber-50 text-amber-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"}`}>AI预审：{risk.riskLevel === "HIGH" ? "高风险" : risk.riskLevel === "MEDIUM" ? "中风险" : "低风险"}</span> : null}
                          {analysis.duplicateLike ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">重复度偏高</span> : null}
                          {analysis.matchedKeywords.length > 0 ? <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700">风险词：{analysis.matchedKeywords.join(" / ")}</span> : null}
                          {!analysis.duplicateLike && analysis.matchedKeywords.length === 0 ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">未发现明显重复或风险词</span> : null}
                        </span>
                        {risk ? <span className="mt-2 block text-xs text-slate-500">{risk.summary}；{risk.reasons.join(" / ")}</span> : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4 text-sm">
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as "ALL" | "MANUAL" | "AI")} className="rounded-lg border border-slate-200 px-3 py-2">
            <option value="ALL">全部来源</option>
            <option value="MANUAL">仅手动</option>
            <option value="AI">仅 AI</option>
          </select>
          <select value={businessFilter} onChange={(event) => setBusinessFilter(event.target.value as "ALL" | AiBusinessType)} className="rounded-lg border border-slate-200 px-3 py-2">
            <option value="ALL">全部业务类型</option>
            <option value="DAILY_PLAN">每日计划</option>
            <option value="QUICK_REPLY">一键回复</option>
            <option value="COMMENT_CONTROL">控评</option>
            <option value="REPOST_ROTATION">轮转</option>
          </select>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">来源</th>
              <th className="px-6 py-3 font-medium">标题</th>
              <th className="px-6 py-3 font-medium">内容</th>
              <th className="px-6 py-3 font-medium">标签</th>
              <th className="px-6 py-3 font-medium">状态</th>
              {canManage ? <th className="px-6 py-3 font-medium">操作</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="px-6 py-8 text-slate-500">
                    暂无文案，先新增一条内容。
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200 align-top">
                  <td className="px-6 py-4">{getCopywritingSourceText(item)}</td>
                  <td className="px-6 py-4">{item.title}</td>
                  <td className="max-w-xl px-6 py-4 text-slate-600">{item.content}</td>
                  <td className="px-6 py-4">{item.tags.join("、") || "-"}</td>
                  <td className="px-6 py-4">{item.status === "ACTIVE" ? "启用" : "停用"}</td>
                   {canManage ? (
                      <td className="px-6 py-4">
                        <button onClick={() => handleEdit(item)} className="mr-4 text-sky-600 hover:text-sky-700">
                          编辑
                        </button>
                        <button onClick={() => handleRewriteAi(item)} disabled={aiRewriting} className="mr-4 text-violet-600 hover:text-violet-700 disabled:opacity-60">
                          再改写
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="text-rose-600 hover:text-rose-700">
                          删除
                        </button>
                     </td>
                   ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
