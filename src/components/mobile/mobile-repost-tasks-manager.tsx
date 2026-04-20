"use client";

import { useMemo, useState } from "react";

type MobileRepostTask = {
  id: string;
  targetUrl: string;
  sequenceNo: number;
  status: "PENDING" | "FAILED" | "SUCCESS" | "RUNNING" | "PARTIAL_FAILED" | "CANCELLED";
  errorMessage: string | null;
  payload: { repostContent?: string } | null;
  account: {
    id: string;
    nickname: string;
  };
  job: {
    id: string;
    status: string;
    createdAt: string;
    config: {
      executionMode?: string;
      times?: number;
    };
  };
};

const statusText: Record<string, string> = {
  PENDING: "待执行",
  FAILED: "失败待重试",
  SUCCESS: "成功",
  RUNNING: "执行中",
  PARTIAL_FAILED: "部分失败",
  CANCELLED: "已取消",
};

export function MobileRepostTasksManager({ initialTasks }: { initialTasks: MobileRepostTask[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const groupedTasks = useMemo(() => {
    const grouped = new Map<string, MobileRepostTask[]>();

    for (const task of tasks) {
      const current = grouped.get(task.job.id) || [];
      current.push(task);
      grouped.set(task.job.id, current);
    }

    return Array.from(grouped.entries()).map(([jobId, items]) => ({
      jobId,
      createdAt: items[0]?.job.createdAt,
      total: items[0]?.job.config?.times || items.length,
      items,
    }));
  }, [tasks]);

  async function reportTask(stepId: string, outcome: "SUCCESS" | "FAILED") {
    const message = outcome === "FAILED" ? window.prompt("失败原因（可选）") || "" : "";

    try {
      setSubmittingId(stepId);
      setError(null);

      const response = await fetch(`/api/mobile/repost-tasks/${stepId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, message }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "回写任务结果失败");
      }

      setTasks((current) => current.filter((task) => task.id !== stepId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "回写任务结果失败");
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">手机执行任务</h2>
        <p className="mt-1 text-sm text-slate-500">轮转转发可改由手机网络执行。点开微博完成后，回来标记结果即可。</p>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {groupedTasks.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">暂无待手机执行的轮转任务。</section>
      ) : (
        groupedTasks.map((group) => (
          <section key={group.jobId} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-medium">轮转任务 {group.jobId.slice(-6)}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  创建于 {new Date(group.createdAt || "").toLocaleString("zh-CN")}，共 {group.total} 条，当前待处理 {group.items.length} 条。
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              {group.items.map((task) => (
                <div key={task.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {task.account.nickname} / 第 {task.sequenceNo} 条 / {statusText[task.status]}
                      </p>
                      <p className="mt-1 break-all text-sm text-slate-500">{task.targetUrl}</p>
                      <p className="mt-1 text-sm text-slate-600">文案：{task.payload?.repostContent || "（空）"}</p>
                      {task.errorMessage ? <p className="mt-1 text-sm text-rose-600">上次失败：{task.errorMessage}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={task.targetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        打开微博
                      </a>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(task.payload?.repostContent || "")}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        复制文案
                      </button>
                      <button
                        type="button"
                        disabled={submittingId === task.id}
                        onClick={() => reportTask(task.id, "SUCCESS")}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        标记成功
                      </button>
                      <button
                        type="button"
                        disabled={submittingId === task.id}
                        onClick={() => reportTask(task.id, "FAILED")}
                        className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        标记失败
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
