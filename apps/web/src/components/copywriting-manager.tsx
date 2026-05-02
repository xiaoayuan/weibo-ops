"use client";

import { useMemo, useState } from "react";

import { AppNotice } from "@/components/app-notice";
import type { AiCopywritingConfig, AiRiskConfig, CopywritingTemplate } from "@/lib/app-data";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";

// ---------------------------------------------------------------------------
// AI workflow types
// ---------------------------------------------------------------------------

type AiBusinessType = "DAILY_PLAN" | "QUICK_REPLY" | "COMMENT_CONTROL" | "REPOST_ROTATION";
type AiTone = "NATURAL" | "PASSERBY" | "SUPPORTIVE" | "DISCUSSIVE" | "LIVELY";
type AiLength = "SHORT" | "STANDARD" | "LONG";
type AiCount = 10 | 20 | 50;

type AiCandidate = {
  title: string;
  content: string;
};

type AiGenerateResult = {
  batchId: string;
  candidates: AiCandidate[];
};

type LinkPreview = {
  summary?: string;
  content?: string;
};

type AiRiskAssessment = {
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  reasons: string[];
  suggestions: string[];
  canBlock: boolean;
};

type AiSaveItem = {
  title: string;
  content: string;
  tags: string[];
  status: "ACTIVE" | "DISABLED";
};

const AI_BUSINESS_TYPE_TEXT: Record<AiBusinessType, string> = {
  DAILY_PLAN: "每日计划",
  QUICK_REPLY: "一键回复",
  COMMENT_CONTROL: "控评",
  REPOST_ROTATION: "轮转",
};

const AI_TONE_TEXT: Record<AiTone, string> = {
  NATURAL: "自然",
  PASSERBY: "路人",
  SUPPORTIVE: "支持",
  DISCUSSIVE: "讨论",
  LIVELY: "活泼",
};

const AI_LENGTH_TEXT: Record<AiLength, string> = {
  SHORT: "短句",
  STANDARD: "标准",
  LONG: "略长",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const AI_COUNT_OPTIONS: AiCount[] = [10, 20, 50];

function isAiCopywriting(item: CopywritingTemplate) {
  return item.tags.includes("AI生成");
}

function getCopywritingSourceText(item: CopywritingTemplate) {
  return isAiCopywriting(item) ? "AI" : "手动";
}

function getBusinessTypeFromTags(item: CopywritingTemplate) {
  if (item.tags.includes("业务:每日计划")) {
    return "DAILY_PLAN";
  }
  if (item.tags.includes("业务:一键回复")) {
    return "QUICK_REPLY";
  }
  if (item.tags.includes("业务:控评")) {
    return "COMMENT_CONTROL";
  }
  if (item.tags.includes("业务:轮转")) {
    return "REPOST_ROTATION";
  }

  return "ALL";
}

type ApiEnvelope<T> = { success: boolean; message?: string; data?: T };

function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return typeof value === "object" && value !== null && "success" in value;
}

function getApiMessage(value: unknown) {
  return isApiEnvelope(value) && typeof value.message === "string" ? value.message : null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CopywritingManager({
  initialItems,
  initialAiConfig,
  initialAiRiskConfig,
}: {
  initialItems: CopywritingTemplate[];
  initialAiConfig: AiCopywritingConfig | null;
  initialAiRiskConfig: AiRiskConfig | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"ALL" | "MANUAL" | "AI">("ALL");
  const [businessFilter, setBusinessFilter] = useState<"ALL" | AiBusinessType>("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // AI workflow state
  const [aiBusinessType, setAiBusinessType] = useState<AiBusinessType>("DAILY_PLAN");
  const [aiTone, setAiTone] = useState<AiTone>("NATURAL");
  const [aiLength, setAiLength] = useState<AiLength>("STANDARD");
  const [aiCount, setAiCount] = useState<AiCount>(10);
  const [aiContext, setAiContext] = useState("");
  const [aiConstraints, setAiConstraints] = useState("");
  const [aiWeiboLink, setAiWeiboLink] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiRewriting, setAiRewriting] = useState(false);
  const [aiLinkPreviewing, setAiLinkPreviewing] = useState(false);
  const [aiRiskChecking, setAiRiskChecking] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [candidates, setCandidates] = useState<AiCandidate[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [riskAssessments, setRiskAssessments] = useState<Map<number, AiRiskAssessment>>(new Map());
  const [linkPreviewResult, setLinkPreviewResult] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiConfig, setAiConfig] = useState({
    baseUrl: initialAiConfig?.baseUrl ?? "",
    model: initialAiConfig?.model ?? "",
    apiKey: "",
    hasApiKey: initialAiConfig?.hasApiKey ?? false,
    apiKeySource: initialAiConfig?.apiKeySource ?? "none",
  });
  const [aiRiskKeywordsText, setAiRiskKeywordsText] = useState((initialAiRiskConfig?.riskyKeywords ?? []).join("\n"));
  const [aiConfigSaving, setAiConfigSaving] = useState(false);
  const [aiRiskConfigSaving, setAiRiskConfigSaving] = useState(false);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSource = sourceFilter === "ALL" || (sourceFilter === "AI" ? isAiCopywriting(item) : !isAiCopywriting(item));
      const businessType = getBusinessTypeFromTags(item);
      const matchesBusiness = businessFilter === "ALL" || businessFilter === businessType;

      return matchesSource && matchesBusiness;
    });
  }, [businessFilter, items, sourceFilter]);

  function resetForm() {
    setEditingId(null);
    setForm(initialForm);
  }

  async function submitForm() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

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
        throw new Error(result.message || (editingId ? "更新文案失败" : "新增文案失败"));
      }

      setItems((current) =>
        editingId ? current.map((item) => (item.id === editingId ? result.data : item)) : [result.data, ...current],
      );
      setNotice(editingId ? "文案已更新" : "文案已创建");
      resetForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : editingId ? "更新文案失败" : "新增文案失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeItem(id: string) {
    if (!window.confirm("确认删除这条文案吗？")) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/copywriting/${id}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "删除文案失败");
      }

      setItems((current) => current.filter((item) => item.id !== id));
      setNotice(result.message || "删除成功");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除文案失败");
    } finally {
      setSubmitting(false);
    }
  }

  // -------------------------------------------------------------------------
  // AI workflow handlers
  // -------------------------------------------------------------------------

  async function handleLinkPreview() {
    if (!aiWeiboLink.trim()) {
      setAiError("请填写微博链接后再预览");
      return;
    }

    setAiLinkPreviewing(true);
    setAiError(null);
    setAiNotice(null);
    setLinkPreviewResult(null);

    try {
      const response = await fetch("/api/copywriting/link-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: aiWeiboLink.trim() }),
      });
      const result = (await response.json()) as ApiEnvelope<unknown>;

      if (!response.ok || !result.success) {
        throw new Error((result as ApiEnvelope<null>).message || "链接预览失败");
      }

      const preview = result.data as LinkPreview;
      const summary = preview.summary ?? preview.content ?? JSON.stringify(preview);
      setLinkPreviewResult(summary.slice(0, 300));
      setAiNotice("预览获取成功，已添加到上下文中");
    } catch (reason) {
      setAiError(reason instanceof Error ? reason.message : "链接预览失败");
    } finally {
      setAiLinkPreviewing(false);
    }
  }

  async function handleGenerate(isRewrite: boolean) {
    const sourceContent = form.content.trim();

    if (!isRewrite && aiContext.trim().length < 5) {
      setAiError("上下文至少需要5个字符，请填写更具体的主题或上下文");
      return;
    }

    if (isRewrite && !sourceContent) {
      setAiError("改写需要原文案内容——请先在下方表单填写或编辑一条已有文案");
      return;
    }

    setAiGenerating(true);
    setAiRewriting(isRewrite);
    setAiError(null);
    setAiNotice(null);
    setCandidates([]);
    setBatchId(null);
    setSelectedIndexes(new Set());
    setRiskAssessments(new Map());
    setLinkPreviewResult(null);

    try {
      const constraints = aiConstraints
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        businessType: aiBusinessType,
        tone: aiTone,
        count: aiCount,
        length: aiLength,
        constraints,
        context: isRewrite ? aiContext.trim() : aiContext.trim(),
      };

      if (isRewrite) {
        body.sourceContent = sourceContent;
      }

      const response = await fetch(isRewrite ? "/api/copywriting/ai-rewrite" : "/api/copywriting/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as ApiEnvelope<AiGenerateResult>;

      if (!response.ok || !result.success) {
        throw new Error(getApiMessage(result) || (isRewrite ? "AI 改写失败" : "AI 生成失败"));
      }

      setCandidates(result.data!.candidates);
      setBatchId(result.data!.batchId);
      setAiNotice(`${result.data!.candidates.length} 条候选已就绪，请勾选后预审或保存`);
    } catch (reason) {
      setAiError(reason instanceof Error ? reason.message : isRewrite ? "AI 改写失败" : "AI 生成失败");
    } finally {
      setAiGenerating(false);
      setAiRewriting(false);
    }
  }

  async function handleRiskCheck() {
    if (selectedIndexes.size === 0) {
      setAiError("请先勾选至少一条候选文案再进行预审");
      return;
    }

    setAiRiskChecking(true);
    setAiError(null);
    setAiNotice(null);

    try {
      const selectedContents = Array.from(selectedIndexes).map((i) => candidates[i]!.content);

      const response = await fetch("/api/ai-risk/copywriting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: aiBusinessType,
          context: aiContext.trim(),
          candidates: selectedContents,
        }),
      });
      const result = (await response.json()) as ApiEnvelope<AiRiskAssessment[]>;

      if (!response.ok || !result.success) {
        throw new Error(getApiMessage(result) || "AI 预审失败");
      }

      const assessments = result.data!;
      const newMap = new Map<number, AiRiskAssessment>();
      Array.from(selectedIndexes).forEach((idx, i) => {
        if (assessments[i]) {
          newMap.set(idx, assessments[i]!);
        }
      });
      setRiskAssessments(newMap);
      setAiNotice("预审完成，风险等级已标注");
    } catch (reason) {
      setAiError(reason instanceof Error ? reason.message : "AI 预审失败");
    } finally {
      setAiRiskChecking(false);
    }
  }

  async function handleSaveSelected() {
    if (selectedIndexes.size === 0) {
      setAiError("请先勾选至少一条候选文案再保存");
      return;
    }

    if (!batchId) {
      setAiError("缺少批次ID，无法保存");
      return;
    }

    setAiSaving(true);
    setAiError(null);
    setAiNotice(null);

    try {
      const constraints = aiConstraints
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const selectedItems: AiSaveItem[] = Array.from(selectedIndexes).map((i) => ({
        title: candidates[i]!.title,
        content: candidates[i]!.content,
        tags: [],
        status: "ACTIVE" as const,
      }));

      const payloadRiskAssessments = Array.from(selectedIndexes)
        .map((i) => {
          const a = riskAssessments.get(i);
          return a
            ? {
                riskLevel: a.riskLevel,
                summary: a.summary,
                reasons: a.reasons,
                suggestions: a.suggestions,
                canBlock: a.canBlock,
              }
            : undefined;
        })
        .filter((a): a is NonNullable<typeof a> => Boolean(a));

      const response = await fetch("/api/copywriting/ai-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId,
          businessType: aiBusinessType,
          tone: aiTone,
          length: aiLength,
          constraints,
          items: selectedItems,
          ...(payloadRiskAssessments.length > 0 ? { riskAssessments: payloadRiskAssessments } : {}),
        }),
      });
      const result = (await response.json()) as ApiEnvelope<CopywritingTemplate[]>;

      if (!response.ok || !result.success) {
        throw new Error(getApiMessage(result) || "保存选中文案失败");
      }

      const saved = result.data!;
      setItems((current) => [...saved, ...current]);
      setCandidates([]);
      setBatchId(null);
      setSelectedIndexes(new Set());
      setRiskAssessments(new Map());
      setLinkPreviewResult(null);
      setAiNotice(`已保存 ${saved.length} 条文案至库`);
    } catch (reason) {
      setAiError(reason instanceof Error ? reason.message : "保存选中文案失败");
    } finally {
      setAiSaving(false);
    }
  }

  async function handleSaveAiConfig() {
    try {
      setAiConfigSaving(true);
      setError(null);
      setNotice(null);

      const response = await fetch("/api/copywriting/ai-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: aiConfig.baseUrl,
          model: aiConfig.model,
          apiKey: aiConfig.apiKey,
        }),
      });
      const result = (await response.json()) as ApiEnvelope<AiCopywritingConfig>;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(getApiMessage(result) || "保存 AI 接口配置失败");
      }

      setAiConfig((current) => ({ ...current, ...result.data!, apiKey: "" }));
      setNotice("AI 接口配置已保存");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存 AI 接口配置失败");
    } finally {
      setAiConfigSaving(false);
    }
  }

  async function handleSaveAiRiskConfig() {
    try {
      setAiRiskConfigSaving(true);
      setError(null);
      setNotice(null);

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
      const result = (await response.json()) as ApiEnvelope<AiRiskConfig>;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(getApiMessage(result) || "保存风险词配置失败");
      }

      setAiRiskKeywordsText(result.data.riskyKeywords.join("\n"));
      setNotice("AI 风险词配置已保存");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存风险词配置失败");
    } finally {
      setAiRiskConfigSaving(false);
    }
  }

  function toggleCandidate(index: number) {
    setSelectedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function riskTone(level: AiRiskAssessment["riskLevel"]): "success" | "warning" | "danger" {
    if (level === "LOW") return "success";
    if (level === "MEDIUM") return "warning";
    return "danger";
  }

  function riskLabel(level: AiRiskAssessment["riskLevel"]) {
    if (level === "LOW") return "低风险";
    if (level === "MEDIUM") return "中风险";
    return "高风险";
  }

  const isAiWorking = aiGenerating || aiRewriting || aiLinkPreviewing || aiRiskChecking || aiSaving;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        eyebrow="文案库"
        title="AI 文案工作流"
        description="通过 AI 生成或改写候选文案，预审后保存至文案库。"
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard>
          <SectionHeader title="AI 接口配置" description="维护 Base URL、模型和 API Key。API Key 保存后不会回显。" />
          <div className="mt-5 grid gap-4">
            <input value={aiConfig.baseUrl} onChange={(event) => setAiConfig((current) => ({ ...current, baseUrl: event.target.value }))} className="app-input" placeholder="AI Base URL" />
            <input value={aiConfig.model} onChange={(event) => setAiConfig((current) => ({ ...current, model: event.target.value }))} className="app-input" placeholder="模型名称" />
            <input type="password" value={aiConfig.apiKey} onChange={(event) => setAiConfig((current) => ({ ...current, apiKey: event.target.value }))} className="app-input" placeholder={aiConfig.hasApiKey ? "已配置 API Key，如需更换请重新输入" : "输入 AI API Key"} />
            <p className="text-xs text-app-text-soft">当前 Key 来源：{aiConfig.apiKeySource === "system" ? "页面配置" : aiConfig.apiKeySource === "env" ? ".env 环境变量" : "未配置"}</p>
            <div>
              <button type="button" onClick={() => void handleSaveAiConfig()} disabled={aiConfigSaving} className="app-button app-button-primary">
                {aiConfigSaving ? "保存中…" : "保存 AI 接口配置"}
              </button>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <SectionHeader title="AI 风险词配置" description="维护高风险关键词，用于候选文案预审和风控提示。" />
          <div className="mt-5 grid gap-4">
            <textarea value={aiRiskKeywordsText} onChange={(event) => setAiRiskKeywordsText(event.target.value)} className="app-input min-h-[220px] resize-y py-3" placeholder="每行一个风险词" />
            <div>
              <button type="button" onClick={() => void handleSaveAiRiskConfig()} disabled={aiRiskConfigSaving} className="app-button app-button-primary">
                {aiRiskConfigSaving ? "保存中…" : "保存风险词配置"}
              </button>
            </div>
          </div>
        </SurfaceCard>
      </div>

      {/* AI workflow */}
      <SurfaceCard>
        <SectionHeader title="AI 生成与改写" description="配置参数后生成候选，改写基于下方表单中的文案内容。" />

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm text-app-text-soft">业务类型</label>
            <select
              value={aiBusinessType}
              onChange={(e) => setAiBusinessType(e.target.value as AiBusinessType)}
              className="app-input w-full"
              disabled={isAiWorking}
            >
              {(Object.keys(AI_BUSINESS_TYPE_TEXT) as AiBusinessType[]).map((bt) => (
                <option key={bt} value={bt}>{AI_BUSINESS_TYPE_TEXT[bt]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-app-text-soft">语气</label>
            <select
              value={aiTone}
              onChange={(e) => setAiTone(e.target.value as AiTone)}
              className="app-input w-full"
              disabled={isAiWorking}
            >
              {(Object.keys(AI_TONE_TEXT) as AiTone[]).map((t) => (
                <option key={t} value={t}>{AI_TONE_TEXT[t]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-app-text-soft">长度</label>
            <select
              value={aiLength}
              onChange={(e) => setAiLength(e.target.value as AiLength)}
              className="app-input w-full"
              disabled={isAiWorking}
            >
              {(Object.keys(AI_LENGTH_TEXT) as AiLength[]).map((l) => (
                <option key={l} value={l}>{AI_LENGTH_TEXT[l]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-app-text-soft">数量</label>
            <select
              value={aiCount}
              onChange={(e) => setAiCount(Number(e.target.value) as AiCount)}
              className="app-input w-full"
              disabled={isAiWorking}
            >
              {AI_COUNT_OPTIONS.map((c) => (
                <option key={c} value={c}>{c} 条</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-app-text-soft">约束（逗号分隔）</label>
            <input
              value={aiConstraints}
              onChange={(e) => setAiConstraints(e.target.value)}
              className="app-input w-full"
              placeholder="如：避免敏感词、不超50字"
              disabled={isAiWorking}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-app-text-soft">微博链接（可选）</label>
            <div className="flex gap-2">
              <input
                value={aiWeiboLink}
                onChange={(e) => setAiWeiboLink(e.target.value)}
                className="app-input flex-1"
                placeholder="https://weibo.com/..."
                disabled={isAiWorking}
              />
              <button
                type="button"
                onClick={() => void handleLinkPreview()}
                disabled={isAiWorking}
                className="app-button app-button-secondary shrink-0"
              >
                {aiLinkPreviewing ? "预览中…" : "预览"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm text-app-text-soft">上下文 / 主题</label>
          <textarea
            value={aiContext}
            onChange={(e) => setAiContext(e.target.value)}
            className="app-input w-full min-h-[100px] resize-y py-3"
            placeholder="描述生成内容的主题、背景或关键信息"
            disabled={isAiWorking}
          />
          {linkPreviewResult && (
            <p className="mt-2 text-sm text-app-text-muted">
              <span className="font-medium text-app-text-soft">链接预览：</span>
              {linkPreviewResult}
            </p>
          )}
        </div>

        {aiError ? <AppNotice tone="error" className="mt-4">{aiError}</AppNotice> : null}
        {aiNotice ? <AppNotice tone="success" className="mt-4">{aiNotice}</AppNotice> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => void handleGenerate(false)}
            disabled={isAiWorking}
            className="app-button app-button-primary"
          >
            {aiGenerating ? "生成中…" : "生成候选"}
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate(true)}
            disabled={isAiWorking}
            className="app-button app-button-secondary"
          >
            {aiRewriting ? "改写中…" : "改写候选"}
          </button>
        </div>
      </SurfaceCard>

      {/* Candidate list */}
      {candidates.length > 0 && (
        <SurfaceCard>
          <SectionHeader
            title={`候选列表（${candidates.length} 条）`}
            action={
              <div className="flex flex-col gap-3 md:flex-row">
                <button
                  type="button"
                  onClick={() => void handleRiskCheck()}
                  disabled={isAiWorking}
                  className="app-button app-button-secondary text-xs"
                >
                  {aiRiskChecking ? "预审中…" : "AI 预审"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveSelected()}
                  disabled={isAiWorking}
                  className="app-button app-button-primary text-xs"
                >
                  {aiSaving ? "保存中…" : `保存选中（${selectedIndexes.size}）`}
                </button>
              </div>
            }
          />

          <div className="mt-5 space-y-3">
            {candidates.map((candidate, index) => {
              const isSelected = selectedIndexes.has(index);
              const assessment = riskAssessments.get(index);

              return (
                <div
                  key={index}
                  onClick={() => toggleCandidate(index)}
                  className={`cursor-pointer rounded-[16px] border p-4 transition-colors ${
                    isSelected
                      ? "border-app-accent/40 bg-app-accent/5"
                      : "border-app-line bg-app-panel-muted hover:border-app-line/60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCandidate(index)}
                      className="mt-1 shrink-0 accent-app-accent"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-app-text-strong">{candidate.title}</p>
                      <p className="mt-1 text-sm leading-6 text-app-text-muted">{candidate.content}</p>
                      {assessment && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusBadge tone={riskTone(assessment.riskLevel)}>
                            {riskLabel(assessment.riskLevel)}
                          </StatusBadge>
                          <span className="text-xs text-app-text-soft">{assessment.summary}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      )}

      {/* Manual form */}
      <SurfaceCard>
        <SectionHeader title={editingId ? "编辑文案" : "新增文案"} />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="app-input" placeholder="标题" />
          <input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} className="app-input" placeholder="标签，多个用英文逗号分隔" />
          <textarea value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} className="app-input min-h-[168px] resize-y py-3 md:col-span-2" placeholder="文案内容" />
          <label className="flex items-center gap-3 rounded-[16px] border border-app-line bg-app-panel-muted px-4 py-3 text-sm text-app-text-soft">
            <input type="checkbox" checked={form.firstComment} onChange={(event) => setForm((current) => ({ ...current, firstComment: event.target.checked }))} />
            标记为首评文案
          </label>
          <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as FormState["status"] }))} className="app-input">
            <option value="ACTIVE">启用</option>
            <option value="DISABLED">停用</option>
          </select>
        </div>

        {error ? <AppNotice tone="error" className="mt-4">{error}</AppNotice> : null}
        {notice ? <AppNotice tone="success" className="mt-4">{notice}</AppNotice> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          {editingId ? (
            <button type="button" onClick={resetForm} className="app-button app-button-secondary">
              取消编辑
            </button>
          ) : null}
          <button type="button" onClick={() => void submitForm()} disabled={submitting} className="app-button app-button-primary">
            {editingId ? "保存修改" : "新增文案"}
          </button>
        </div>
      </SurfaceCard>

      {/* List */}
      <SurfaceCard>
        <SectionHeader
          title="文案列表"
          action={
            <div className="flex flex-col gap-3 md:flex-row">
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as "ALL" | "MANUAL" | "AI")} className="app-input md:w-[180px]">
                <option value="ALL">全部来源</option>
                <option value="MANUAL">手动</option>
                <option value="AI">AI</option>
              </select>
              <select value={businessFilter} onChange={(event) => setBusinessFilter(event.target.value as "ALL" | AiBusinessType)} className="app-input md:w-[220px]">
                <option value="ALL">全部业务</option>
                <option value="DAILY_PLAN">每日计划</option>
                <option value="QUICK_REPLY">一键回复</option>
                <option value="COMMENT_CONTROL">控评</option>
                <option value="REPOST_ROTATION">轮转</option>
              </select>
            </div>
          }
        />

        {filteredItems.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="暂无文案" description="当前筛选下没有文案。你可以先新增一条，或者切换筛选条件。" />
          </div>
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[1180px]">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>内容预览</th>
                  <th>标签</th>
                  <th>来源</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium text-app-text-strong">{item.title}</td>
                    <td className="max-w-[340px] text-sm leading-7 text-app-text-muted">{item.content}</td>
                    <td>
                      <div className="flex max-w-[220px] flex-wrap gap-2">
                        {item.tags.length > 0 ? item.tags.map((tag) => <span key={tag} className="app-chip">{tag}</span>) : <span className="text-app-text-soft">-</span>}
                      </div>
                    </td>
                    <td>{getCopywritingSourceText(item)}</td>
                    <td>
                      <StatusBadge tone={item.status === "ACTIVE" ? "success" : "neutral"}>{item.status === "ACTIVE" ? "启用" : "停用"}</StatusBadge>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(item.id);
                            setForm({
                              title: item.title,
                              content: item.content,
                              tags: item.tags.join(", "),
                              firstComment: item.tags.includes("首评文案") || item.tags.includes("FIRST_COMMENT"),
                              status: item.status as FormState["status"],
                            });
                          }}
                          className="app-button app-button-secondary h-10 px-4 text-xs"
                        >
                          编辑
                        </button>
                        <button type="button" onClick={() => void removeItem(item.id)} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs text-app-danger hover:border-app-danger/30 hover:text-app-danger">
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </SurfaceCard>
    </div>
  );
}
