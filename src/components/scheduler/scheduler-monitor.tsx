"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type QueueSnapshot = {
  userId: string;
  username: string | null;
  taskConcurrency: number;
  pendingCount: number;
  runningCount: number;
  pendingLabels: string[];
  runningLabels: string[];
};

type WorkerSnapshot = {
  workerId: string;
  queueCount: number;
  users: QueueSnapshot[];
};

type SchedulerMonitorData = {
  workerCount: number;
  workers: WorkerSnapshot[];
  updatedAt: string;
};

function renderLabels(labels: string[]) {
  if (labels.length === 0) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label) => (
        <span key={label} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
          {label}
        </span>
      ))}
    </div>
  );
}

export function SchedulerMonitor({ initialData }: { initialData: SchedulerMonitorData }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    try {
      setRefreshing(true);
      router.refresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">调度监控</h2>
          <p className="mt-1 text-sm text-slate-500">查看 2 个逻辑 worker 下的用户独立队列、并发数和当前排队任务。</p>
          <p className="mt-2 text-xs text-slate-500">最近更新时间：{new Date(initialData.updatedAt).toLocaleString("zh-CN")}</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? "刷新中..." : "手动刷新"}
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Worker 数量</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{initialData.workerCount}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-slate-500">总用户队列</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{initialData.workers.reduce((sum, worker) => sum + worker.queueCount, 0)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-slate-500">运行中任务</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {initialData.workers.reduce(
                (sum, worker) => sum + worker.users.reduce((userSum, user) => userSum + user.runningCount, 0),
                0,
              )}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {initialData.workers.map((worker) => (
          <section key={worker.workerId} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-medium text-slate-900">{worker.workerId}</h3>
                <p className="mt-1 text-sm text-slate-500">当前挂载用户队列：{worker.queueCount}</p>
              </div>
            </div>

            {worker.users.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">当前 worker 暂无可见用户队列。</div>
            ) : (
              <div className="space-y-4">
                {worker.users.map((user) => (
                  <div key={user.userId} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{user.username || "未知用户"}</p>
                        <p className="mt-1 text-xs text-slate-500">{user.userId}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm text-slate-600">
                        <div>
                          <p className="text-xs text-slate-500">并发数</p>
                          <p className="mt-1 font-medium text-slate-900">{user.taskConcurrency}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">运行中</p>
                          <p className="mt-1 font-medium text-slate-900">{user.runningCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">等待中</p>
                          <p className="mt-1 font-medium text-slate-900">{user.pendingCount}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Running</p>
                        {renderLabels(user.runningLabels)}
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Pending</p>
                        {renderLabels(user.pendingLabels)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
