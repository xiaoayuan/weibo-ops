"use client";

import { useState } from "react";

import { AppNotice } from "@/components/app-notice";
import { SurfaceCard } from "@/components/surface-card";
import type { ExecutionStrategy } from "@/lib/app-data";
import { readJsonResponse } from "@/lib/http";

type ConcurrencyForm = {
  S: number;
  A: number;
  B: number;
};

type UrgencyForm = {
  waveRatios: [number, number, number];
  waveWindowsSec: [number, number, number];
  cooldownSecRange: [number, number];
  retryDelaySecRange: [number, number];
  targetSlaSec: number;
  limitSlaSec: number;
};

type StrategyDraft = {
  maxRetry: number;
  commentLikeConcurrency: ConcurrencyForm;
  repostConcurrency: ConcurrencyForm;
  urgency: {
    S: UrgencyForm;
    A: UrgencyForm;
    B: UrgencyForm;
  };
  circuitBreaker: {
    accountFailureThreshold: number;
    accountPauseMinutes: number;
    proxyWindowMinutes: number;
    proxyMinSamples: number;
    proxyFailureRatio: number;
    proxyPauseMinutes: number;
  };
};

function toDraft(strategy: ExecutionStrategy): StrategyDraft {
  return {
    maxRetry: strategy.actionJob.maxRetry,
    commentLikeConcurrency: strategy.actionJob.commentLikeConcurrency,
    repostConcurrency: strategy.actionJob.repostConcurrency,
    urgency: strategy.actionJob.urgency,
    circuitBreaker: strategy.circuitBreaker,
  };
}

export function ExecutionStrategyForm({ initial }: { initial: ExecutionStrategy }) {
  const [draft, setDraft] = useState<StrategyDraft>(toDraft(initial));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function update(draft: StrategyDraft) {
    setDraft(draft);
    setError(null);
    setNotice(null);
  }

  async function save() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch("/api/strategy-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = await readJsonResponse<{ success: boolean; message?: string }>(response);

      if (!response.ok) {
        throw new Error(result.message || "保存失败");
      }

      setNotice(result.message || "执行策略已保存");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  }

  const tierLabels: Record<"S" | "A" | "B", string> = { S: "S 级（紧急）", A: "A 级（常规）", B: "B 级（低优）" };

  return (
    <div className="space-y-5">
      {/* 并发控制 */}
      <div className="grid gap-5 md:grid-cols-2">
        <SurfaceCard className="rounded-[20px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">控评并发上限</p>
          <div className="mt-4 space-y-3">
            {(Object.keys(tierLabels) as Array<"S" | "A" | "B">).map((tier) => (
              <div key={tier} className="flex items-center justify-between">
                <span className="text-sm text-app-text-muted">{tierLabels[tier]}</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={draft.commentLikeConcurrency[tier]}
                  onChange={(e) => update({ ...draft, commentLikeConcurrency: { ...draft.commentLikeConcurrency, [tier]: Number(e.target.value) || 1 } })}
                  className="app-input h-10 w-[120px] text-center"
                />
              </div>
            ))}
          </div>
        </SurfaceCard>
        <SurfaceCard className="rounded-[20px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">轮转并发上限</p>
          <div className="mt-4 space-y-3">
            {(Object.keys(tierLabels) as Array<"S" | "A" | "B">).map((tier) => (
              <div key={tier} className="flex items-center justify-between">
                <span className="text-sm text-app-text-muted">{tierLabels[tier]}</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={draft.repostConcurrency[tier]}
                  onChange={(e) => update({ ...draft, repostConcurrency: { ...draft.repostConcurrency, [tier]: Number(e.target.value) || 1 } })}
                  className="app-input h-10 w-[120px] text-center"
                />
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>

      {/* 熔断配置 */}
      <SurfaceCard className="rounded-[20px] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">熔断配置</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs text-app-text-muted">账号失败阈值</label>
            <input
              type="number"
              min={1}
              max={20}
              value={draft.circuitBreaker.accountFailureThreshold}
              onChange={(e) => update({ ...draft, circuitBreaker: { ...draft.circuitBreaker, accountFailureThreshold: Number(e.target.value) || 1 } })}
              className="app-input h-10"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-app-text-muted">账号暂停分钟</label>
            <input
              type="number"
              min={1}
              max={1440}
              value={draft.circuitBreaker.accountPauseMinutes}
              onChange={(e) => update({ ...draft, circuitBreaker: { ...draft.circuitBreaker, accountPauseMinutes: Number(e.target.value) || 1 } })}
              className="app-input h-10"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-app-text-muted">代理失败比率</label>
            <input
              type="number"
              min={0.05}
              max={1}
              step={0.05}
              value={draft.circuitBreaker.proxyFailureRatio}
              onChange={(e) => update({ ...draft, circuitBreaker: { ...draft.circuitBreaker, proxyFailureRatio: Number(e.target.value) || 0.4 } })}
              className="app-input h-10"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-app-text-muted">代理窗口分钟</label>
            <input
              type="number"
              min={1}
              max={120}
              value={draft.circuitBreaker.proxyWindowMinutes}
              onChange={(e) => update({ ...draft, circuitBreaker: { ...draft.circuitBreaker, proxyWindowMinutes: Number(e.target.value) || 1 } })}
              className="app-input h-10"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-app-text-muted">代理最小采样</label>
            <input
              type="number"
              min={1}
              max={500}
              value={draft.circuitBreaker.proxyMinSamples}
              onChange={(e) => update({ ...draft, circuitBreaker: { ...draft.circuitBreaker, proxyMinSamples: Number(e.target.value) || 1 } })}
              className="app-input h-10"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-app-text-muted">代理暂停分钟</label>
            <input
              type="number"
              min={1}
              max={1440}
              value={draft.circuitBreaker.proxyPauseMinutes}
              onChange={(e) => update({ ...draft, circuitBreaker: { ...draft.circuitBreaker, proxyPauseMinutes: Number(e.target.value) || 1 } })}
              className="app-input h-10"
            />
          </div>
        </div>
      </SurfaceCard>

      {error ? <AppNotice tone="error">{error}</AppNotice> : null}
      {notice ? <AppNotice tone="success">{notice}</AppNotice> : null}

      <div className="flex justify-end">
        <button type="button" onClick={() => void save()} disabled={submitting} className="app-button app-button-primary">
          {submitting ? "保存中" : "保存执行策略"}
        </button>
      </div>
    </div>
  );
}
