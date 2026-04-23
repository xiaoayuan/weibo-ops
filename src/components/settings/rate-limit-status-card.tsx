"use client";

import { useState } from "react";

type RateLimitSnapshotItem = {
  key: string;
  nextAvailableAt: string | null;
  waitMs: number;
  active: boolean;
};

type RateLimitSnapshot = {
  global: RateLimitSnapshotItem | null;
  taskTypes: Array<RateLimitSnapshotItem & { taskType: string }>;
  users: Array<RateLimitSnapshotItem & { userId: string; username: string | null }>;
  updatedAt: string;
};

function toneClass(active: boolean) {
  return active
    ? "bg-amber-50 text-amber-700 border border-amber-200"
    : "bg-emerald-50 text-emerald-700 border border-emerald-200";
}

function waitText(waitMs: number) {
  if (waitMs <= 0) {
    return "无等待";
  }

  if (waitMs < 60_000) {
    return `${Math.ceil(waitMs / 1000)} 秒`;
  }

  return `${Math.ceil(waitMs / 60_000)} 分钟`;
}

export function RateLimitStatusCard({ initialSnapshot }: { initialSnapshot: RateLimitSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshStatus() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/task-scheduler/status", { method: "GET", cache: "no-store" });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "读取限速状态失败");
      }

      setSnapshot(result.data.rateLimit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取限速状态失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium">限速状态</h3>
          <p className="mt-1 text-sm text-slate-500">查看全站、任务类型和用户级软限速是否正在生效。</p>
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
          <p className="text-xs text-slate-500">全站</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneClass(Boolean(snapshot.global?.active))}`}>
              {snapshot.global?.active ? "限速中" : "正常"}
            </span>
            <span className="text-sm text-slate-700">{waitText(snapshot.global?.waitMs || 0)}</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 md:col-span-2">
          <p className="text-xs text-slate-500">任务类型</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {snapshot.taskTypes.map((item) => (
              <span key={item.key} className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneClass(item.active)}`}>
                {item.taskType}: {item.active ? waitText(item.waitMs) : "正常"}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700">用户级限速</p>
          <p className="text-xs text-slate-400">更新时间 {new Date(snapshot.updatedAt).toLocaleString("zh-CN")}</p>
        </div>
        {snapshot.users.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">当前没有用户级等待。</p>
        ) : (
          <div className="mt-3 space-y-2">
            {snapshot.users.slice(0, 8).map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <span className="text-slate-700">{item.username || item.userId}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneClass(item.active)}`}>{item.active ? waitText(item.waitMs) : "正常"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </section>
  );
}
