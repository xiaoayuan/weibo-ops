"use client";

import { useState } from "react";

type ExecutorHealthStatus = {
  mode: string;
  executorClass: string;
  isRealExecutor: boolean;
  modeMatchesExecutor: boolean;
};

function toneClass(ok: boolean) {
  return ok
    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
    : "bg-rose-50 text-rose-700 border border-rose-200";
}

export function ExecutorHealthCard({ initialStatus }: { initialStatus: ExecutorHealthStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshStatus() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/health/executor", {
        method: "GET",
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "读取执行器状态失败");
      }

      setStatus(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取执行器状态失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium">执行器状态</h3>
          <p className="mt-1 text-sm text-slate-500">用于确认当前实例是否走真实执行链路。</p>
        </div>
        <button
          type="button"
          onClick={refreshStatus}
          disabled={loading}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "刷新中..." : "刷新状态"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">EXECUTOR_MODE</p>
          <p className="mt-2 text-sm font-medium text-slate-900">{status.mode || "未设置"}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">执行器实现</p>
          <p className="mt-2 text-sm font-medium text-slate-900">{status.executorClass}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">运行判定</p>
          <p className="mt-2 text-sm font-medium text-slate-900">{status.isRealExecutor ? "真实执行" : "虚拟执行"}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded-full px-2.5 py-1 font-medium ${toneClass(status.isRealExecutor)}`}>
          {status.isRealExecutor ? "真实执行器已生效" : "当前不是真实执行器"}
        </span>
        <span className={`rounded-full px-2.5 py-1 font-medium ${toneClass(status.modeMatchesExecutor)}`}>
          {status.modeMatchesExecutor ? "模式与实现一致" : "模式与实现不一致"}
        </span>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </section>
  );
}
