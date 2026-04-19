"use client";

import type { InteractionTarget, InteractionTask, WeiboAccount } from "@/generated/prisma/client";
import { canManageBusinessData, canReviewAndExecuteTasks } from "@/lib/permission-rules";
import type { AppRole } from "@/lib/permission-rules";
import { FormEvent, useState } from "react";

type InteractionTaskWithRelations = InteractionTask & {
  account: WeiboAccount;
  target: InteractionTarget;
};

type InteractionStatus = "PENDING" | "READY" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
type InteractionActionType = "LIKE" | "POST";

const statusText: Record<InteractionStatus, string> = {
  PENDING: "待审核",
  READY: "已确认",
  RUNNING: "执行中",
  SUCCESS: "成功",
  FAILED: "失败",
  CANCELLED: "已取消",
};

export function InteractionsManager({
  accounts,
  currentUserRole,
  initialTasks,
}: {
  accounts: WeiboAccount[];
  currentUserRole: AppRole;
  initialTasks: InteractionTaskWithRelations[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [targetUrl, setTargetUrl] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [actionType, setActionType] = useState<InteractionActionType>("LIKE");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<InteractionStatus | "ALL">("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = canManageBusinessData(currentUserRole);
  const canExecute = canReviewAndExecuteTasks(currentUserRole);

  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = statusFilter === "ALL" || task.status === statusFilter;
    const matchesKeyword =
      keyword.trim() === "" ||
      task.target.targetUrl.toLowerCase().includes(keyword.trim().toLowerCase()) ||
      task.account.nickname.toLowerCase().includes(keyword.trim().toLowerCase());

    return matchesStatus && matchesKeyword;
  });

  function toggleAccount(id: string) {
    setSelectedAccounts((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch("/api/interaction-tasks/batch-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl,
          accountIds: selectedAccounts,
          actionType,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "创建互动任务失败");
      }

      setTasks((current) => [...result.data, ...current]);
      setTargetUrl("");
      setSelectedAccounts([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建互动任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: string, status: InteractionStatus) {
    try {
      setError(null);

      const response = await fetch(`/api/interaction-tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "更新互动任务失败");
      }

      setTasks((current) => current.map((item) => (item.id === id ? result.data : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新互动任务失败");
    }
  }

  async function handleExecute(id: string) {
    try {
      setError(null);

      const response = await fetch(`/api/interaction-tasks/${id}/execute`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "执行互动任务失败");
      }

      setTasks((current) => current.map((item) => (item.id === id ? result.data : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "执行互动任务失败");
    }
  }

  async function handleApprove(id: string) {
    try {
      setError(null);

      const response = await fetch(`/api/interaction-tasks/${id}/approve`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "确认互动任务失败");
      }

      setTasks((current) => current.map((item) => (item.id === id ? result.data : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "确认互动任务失败");
    }
  }

  async function handleReject(id: string) {
    try {
      setError(null);

      const response = await fetch(`/api/interaction-tasks/${id}/reject`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "驳回互动任务失败");
      }

      setTasks((current) => current.map((item) => (item.id === id ? result.data : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "驳回互动任务失败");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">互动任务</h2>
        <p className="mt-1 text-sm text-slate-500">录入微博链接或评论直达链接，并为多个账号批量生成点赞或转发任务。</p>
      </div>

      {canManage ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium">新增互动任务</h3>
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <select
            value={actionType}
            onChange={(event) => setActionType(event.target.value as InteractionActionType)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="LIKE">点赞</option>
            <option value="POST">转发</option>
          </select>
          <input
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                placeholder="填写微博详情链接"
          />

          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-700">选择参与账号</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {accounts.map((account) => (
                <label key={account.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedAccounts.includes(account.id)}
                    onChange={() => toggleAccount(account.id)}
                  />
                  {account.nickname}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            {error ? <p className="text-sm text-rose-600">{error}</p> : <div />}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "提交中..." : "生成互动任务"}
            </button>
          </div>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-lg font-medium">任务列表</h3>
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索链接或账号"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as InteractionStatus | "ALL")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="ALL">全部状态</option>
                <option value="PENDING">待执行</option>
                <option value="READY">待确认</option>
                <option value="RUNNING">执行中</option>
                <option value="SUCCESS">成功</option>
                <option value="FAILED">失败</option>
                <option value="CANCELLED">已取消</option>
              </select>
            </div>
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">目标链接</th>
              <th className="px-6 py-3 font-medium">账号</th>
              <th className="px-6 py-3 font-medium">动作</th>
              <th className="px-6 py-3 font-medium">状态</th>
              <th className="px-6 py-3 font-medium">创建时间</th>
              <th className="px-6 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-slate-500">
                  暂无互动任务。
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => (
                <tr key={task.id} className="border-t border-slate-200">
                  <td className="px-6 py-4 text-sky-600">{task.target.targetUrl}</td>
                  <td className="px-6 py-4">{task.account.nickname}</td>
                  <td className="px-6 py-4">{task.actionType === "LIKE" ? "点赞" : "转发"}</td>
                  <td className="px-6 py-4">{statusText[task.status]}</td>
                  <td className="px-6 py-4">{new Date(task.createdAt).toLocaleString("zh-CN")}</td>
                  <td className="px-6 py-4">
                     {canExecute ? (
                       <div className="flex flex-wrap gap-2">
                         {task.status === "PENDING" ? (
                           <>
                             <button onClick={() => handleApprove(task.id)} className="text-sky-600 hover:text-sky-700">
                               确认
                             </button>
                             <button onClick={() => handleReject(task.id)} className="text-rose-600 hover:text-rose-700">
                               驳回
                             </button>
                           </>
                         ) : null}
                         <button onClick={() => handleExecute(task.id)} className="text-violet-600 hover:text-violet-700">
                           执行预检
                         </button>
                         <button onClick={() => handleStatusChange(task.id, "SUCCESS")} className="text-emerald-600 hover:text-emerald-700">
                           成功
                         </button>
                         <button onClick={() => handleStatusChange(task.id, "FAILED")} className="text-amber-600 hover:text-amber-700">
                           失败
                         </button>
                         <button onClick={() => handleStatusChange(task.id, "CANCELLED")} className="text-rose-600 hover:text-rose-700">
                           取消
                         </button>
                       </div>
                     ) : (
                       <span className="text-slate-400">只读</span>
                     )}
                   </td>
                 </tr>
               ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
