"use client";

import { useState } from "react";

import { AppNotice } from "@/components/app-notice";
import { SurfaceCard } from "@/components/surface-card";
import type { RiskRules } from "@/lib/app-data";
import { readJsonResponse } from "@/lib/http";

type Draft = {
  keywords: RiskRules["keywords"];
  score: RiskRules["score"];
  threshold: RiskRules["threshold"];
};

function toDraft(rules: RiskRules): Draft {
  return {
    keywords: { ...rules.keywords },
    score: { ...rules.score },
    threshold: { ...rules.threshold },
  };
}

const keywordFields: Array<{ key: keyof RiskRules["keywords"]; label: string; tip: string }> = [
  { key: "targetIssue", label: "目标失效", tip: "帖子不存在/已删除/评论满" },
  { key: "contentIssue", label: "内容缺失", tip: "文案/模板缺失" },
  { key: "transientNetwork", label: "网络抖动", tip: "代理/超时/连接失败" },
  { key: "platformBusy", label: "平台繁忙", tip: "系统忙/请稍后" },
  { key: "accountRisk", label: "账号风险", tip: "Cookie 失效/登录态异常" },
];

const scoreFields: Array<{ key: keyof RiskRules["score"]; label: string; tip: string; min: number; max: number }> = [
  { key: "success", label: "成功扣分", tip: "≤ 0", min: -5, max: 0 },
  { key: "targetIssue", label: "目标失效加", tip: "0 = 不加", min: 0, max: 5 },
  { key: "contentIssue", label: "内容缺失加", tip: "0 = 不加", min: 0, max: 5 },
  { key: "transientNetwork", label: "网络抖动加", tip: "≥ 1", min: 0, max: 5 },
  { key: "platformBusy", label: "平台繁忙加", tip: "≥ 1", min: 0, max: 5 },
  { key: "accountRisk", label: "账号风险加", tip: "≥ 2", min: 0, max: 10 },
  { key: "unknownFailure", label: "未知失败加", tip: "≥ 1", min: 0, max: 5 },
];

const thresholdFields: Array<{ key: keyof RiskRules["threshold"]; label: string; tip: string; min: number; max: number }> = [
  { key: "markRiskyAt", label: "风险标记阈值", tip: "markRiskyAt", min: 1, max: 20 },
  { key: "recoverActiveAt", label: "恢复 ACTIVE 阈值", tip: "recoverActiveAt", min: 0, max: 20 },
  { key: "maxRiskLevel", label: "风险等级上限", tip: "maxRiskLevel", min: 5, max: 50 },
];

export function RiskRulesForm({ initial }: { initial: RiskRules }) {
  const [draft, setDraft] = useState<Draft>(toDraft(initial));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function updateScore(key: keyof RiskRules["score"], value: number) {
    setDraft((prev) => ({ ...prev, score: { ...prev.score, [key]: value } }));
    setError(null);
    setNotice(null);
  }

  function updateThreshold(key: keyof RiskRules["threshold"], value: number) {
    setDraft((prev) => ({ ...prev, threshold: { ...prev.threshold, [key]: value } }));
    setError(null);
    setNotice(null);
  }

  function updateKeywords(key: keyof RiskRules["keywords"], text: string) {
    const items = text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    setDraft((prev) => ({ ...prev, keywords: { ...prev.keywords, [key]: items } }));
    setError(null);
    setNotice(null);
  }

  async function save() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch("/api/risk-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = await readJsonResponse<{ success: boolean; message?: string }>(response);

      if (!response.ok) {
        throw new Error(result.message || "保存失败");
      }

      setNotice(result.message || "风控规则已保存");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* 命中关键词 */}
      <SurfaceCard className="rounded-[20px] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">命中关键词（每行一个）</p>
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {keywordFields.map((field) => (
            <div key={field.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-app-text-muted">{field.label}</label>
                <span className="text-[10px] text-app-text-soft">{field.tip}</span>
              </div>
              <textarea
                value={(draft.keywords[field.key] || []).join("\n")}
                onChange={(e) => updateKeywords(field.key, e.target.value)}
                rows={4}
                className="app-input min-h-[100px] resize-y text-xs"
                placeholder="每行一个关键词"
              />
            </div>
          ))}
        </div>
      </SurfaceCard>

      {/* 风险加分 + 阈值 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <SurfaceCard className="rounded-[20px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">风险加分（整数）</p>
          <div className="mt-4 space-y-3">
            {scoreFields.map((field) => (
              <div key={field.key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-app-text-muted">{field.label}</span>
                  <span className="text-[10px] text-app-text-soft">{field.tip}</span>
                </div>
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  value={draft.score[field.key]}
                  onChange={(e) => updateScore(field.key, Number(e.target.value) || 0)}
                  className="app-input h-10 w-[120px] text-center"
                />
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard className="rounded-[20px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">风控阈值</p>
          <div className="mt-4 space-y-3">
            {thresholdFields.map((field) => (
              <div key={field.key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-app-text-muted">{field.label}</span>
                  <span className="text-[10px] font-mono text-app-text-soft">{field.tip}</span>
                </div>
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  value={draft.threshold[field.key]}
                  onChange={(e) => updateThreshold(field.key, Number(e.target.value) || 0)}
                  className="app-input h-10 w-[120px] text-center"
                />
              </div>
            ))}
            <div className="border-t border-app-line pt-3 text-xs text-app-text-soft">
              必须满足：恢复阈值 &lt; 标记阈值
            </div>
          </div>
        </SurfaceCard>
      </div>

      {error ? <AppNotice tone="error">{error}</AppNotice> : null}
      {notice ? <AppNotice tone="success">{notice}</AppNotice> : null}

      <div className="flex justify-end">
        <button type="button" onClick={() => void save()} disabled={submitting} className="app-button app-button-primary">
          {submitting ? "保存中" : "保存风控规则"}
        </button>
      </div>
    </div>
  );
}