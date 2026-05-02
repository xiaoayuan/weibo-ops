"use client";

import { useState } from "react";

import { AppNotice } from "@/components/app-notice";
import { StatusBadge } from "@/components/status-badge";
import type { ExecutorHealth } from "@/lib/app-data";
import { readJsonResponse } from "@/lib/http";

type ExecutorHealthResponse = {
  success: boolean;
  message?: string;
  data: ExecutorHealth;
};

export function ExecutorHealthCard({ initial }: { initial: ExecutorHealth | null }) {
  const [status, setStatus] = useState<ExecutorHealth | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshStatus() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/health/executor", { cache: "no-store" });
      const result = await readJsonResponse<ExecutorHealthResponse>(response);

      if (!response.ok || !result.success) {
        throw new Error(result.message || "读取执行器状态失败");
      }

      setStatus(result.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "读取执行器状态失败");
    } finally {
      setLoading(false);
    }
  }

  if (!status) {
    return (
      <div className="space-y-4">
        <AppNotice tone="error">当前未取到执行器状态。</AppNotice>
        <button type="button" onClick={() => void refreshStatus()} disabled={loading} className="app-button app-button-secondary h-10 px-4 text-xs">
          {loading ? "刷新中" : "重试读取"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-app-text-soft">用于确认当前实例是否走真实执行链路。</p>
        </div>
        <button type="button" onClick={() => void refreshStatus()} disabled={loading} className="app-button app-button-secondary h-10 px-4 text-xs">
          {loading ? "刷新中" : "刷新状态"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[18px] border border-app-line bg-app-panel-muted p-4">
          <p className="text-xs text-app-text-soft">EXECUTOR_MODE</p>
          <p className="mt-2 text-sm font-medium text-app-text-strong">{status.mode || "未设置"}</p>
        </div>
        <div className="rounded-[18px] border border-app-line bg-app-panel-muted p-4">
          <p className="text-xs text-app-text-soft">执行器实现</p>
          <p className="mt-2 text-sm font-medium text-app-text-strong">{status.executorClass}</p>
        </div>
        <div className="rounded-[18px] border border-app-line bg-app-panel-muted p-4">
          <p className="text-xs text-app-text-soft">运行判定</p>
          <p className="mt-2 text-sm font-medium text-app-text-strong">{status.isRealExecutor ? "真实执行" : "虚拟执行"}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusBadge tone={status.isRealExecutor ? "success" : "danger"}>{status.isRealExecutor ? "真实执行器已生效" : "当前不是真实执行器"}</StatusBadge>
        <StatusBadge tone={status.modeMatchesExecutor ? "success" : "warning"}>{status.modeMatchesExecutor ? "模式与实现一致" : "模式与实现不一致"}</StatusBadge>
      </div>

      {error ? <AppNotice tone="error">{error}</AppNotice> : null}
    </div>
  );
}
