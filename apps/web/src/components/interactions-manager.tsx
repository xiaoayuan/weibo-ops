"use client";

import { useMemo, useState } from "react";

import { AppNotice } from "@/components/app-notice";
import type { CopywritingTemplate, InteractionTask, WeiboAccount } from "@/lib/app-data";
import { formatDateTime } from "@/lib/date";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";

function getActionText(actionType: InteractionTask["actionType"]) {
  const map: Record<InteractionTask["actionType"], string> = {
    LIKE: "点赞",
    POST: "转发",
    COMMENT: "回复",
  };

  return map[actionType] || actionType;
}

function getStatusText(status: InteractionTask["status"]) {
  const map: Record<InteractionTask["status"], string> = {
    PENDING: "待执行",
    READY: "待确认",
    RUNNING: "执行中",
    SUCCESS: "成功",
    FAILED: "失败",
    CANCELLED: "已取消",
  };

  return map[status] || status;
}

export function InteractionsManager({
  accounts,
  contents,
  initialTasks,
}: {
  accounts: WeiboAccount[];
  contents: CopywritingTemplate[];
  initialTasks: InteractionTask[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [targetInput, setTargetInput] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);
  const [actionType, setActionType] = useState<InteractionTask["actionType"]>("LIKE");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<InteractionTask["status"] | "ALL">("ALL");
  const [actionFilter, setActionFilter] = useState<InteractionTask["actionType"] | "ALL">("ALL");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesStatus = statusFilter === "ALL" || task.status === statusFilter;
      const matchesAction = actionFilter === "ALL" || task.actionType === actionFilter;
      const matchesKeyword =
        normalized === "" ||
        task.target.targetUrl.toLowerCase().includes(normalized) ||
        task.account.nickname.toLowerCase().includes(normalized) ||
        (task.content?.title || "").toLowerCase().includes(normalized);

      return matchesStatus && matchesAction && matchesKeyword;
    });
  }, [actionFilter, keyword, statusFilter, tasks]);

  async function refreshTasks() {
    const response = await fetch("/api/interaction-tasks", { cache: "no-store" });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "刷新互动任务失败");
    }

    setTasks(result.data);
  }

  async function createBatch() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch("/api/interaction-tasks/batch-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: actionType === "COMMENT" ? undefined : targetInput.trim(),
          targetUrls:
            actionType === "COMMENT"
              ? targetInput
                  .split(/\n+/)
                  .map((item) => item.trim())
                  .filter(Boolean)
              : undefined,
          accountIds: selectedAccounts,
          contentIds: actionType === "COMMENT" ? selectedContentIds : undefined,
          actionType,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "创建互动任务失败");
      }

      setTasks((current) => [...result.data, ...current]);
      setTargetInput("");
      setSelectedAccounts([]);
      setSelectedContentIds([]);
      setNotice(result.message || `已创建 ${result.meta?.createdCount || 0} 条互动任务`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建互动任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function runTaskAction(path: string, successMessage?: string, updater?: (payload: InteractionTask[]) => void) {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "操作失败");
      }

      if (result.data?.id) {
        setTasks((current) => current.map((item) => (item.id === result.data.id ? result.data : item)));
      }

      if (updater) {
        updater(result.data);
      }

      setNotice(result.message || successMessage || "操作完成");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteTask(id: string) {
    if (!window.confirm("确认删除这条互动任务吗？")) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/interaction-tasks/${id}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "删除互动任务失败");
      }

      setTasks((current) => current.filter((item) => item.id !== id));
      setNotice(result.message || "删除成功");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除互动任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function batchDelete() {
    if (selectedTaskIds.length === 0) {
      setError("请先选择至少一条互动任务");
      return;
    }

    if (!window.confirm(`确认删除选中的 ${selectedTaskIds.length} 条互动任务吗？`)) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch("/api/interaction-tasks/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: selectedTaskIds }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "批量删除失败");
      }

      const deletedIds = new Set(result.data.deletedIds as string[]);
      setTasks((current) => current.filter((item) => !deletedIds.has(item.id)));
      setSelectedTaskIds([]);
      setNotice(result.message || "批量删除完成");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "批量删除失败");
    } finally {
      setSubmitting(false);
    }
  }

  const stats = {
    total: tasks.length,
    pending: tasks.filter((task) => task.status === "PENDING" || task.status === "READY").length,
    running: tasks.filter((task) => task.status === "RUNNING").length,
    failed: tasks.filter((task) => task.status === "FAILED").length,
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader eyebrow="互动任务" title="迁移互动创建、执行和批量处理主流程" description="这一轮先把互动任务的创建、执行、审批、停止和批量删除迁过来，保证互动侧常用流程能在独立前端闭环。" />

      <section className="grid gap-4 md:grid-cols-4">
        <SurfaceCard className="rounded-[20px] p-5"><p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">任务总数</p><p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{stats.total}</p></SurfaceCard>
        <SurfaceCard className="rounded-[20px] p-5"><p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">待处理</p><p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{stats.pending}</p></SurfaceCard>
        <SurfaceCard className="rounded-[20px] p-5"><p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">执行中</p><p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{stats.running}</p></SurfaceCard>
        <SurfaceCard className="rounded-[20px] p-5"><p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">失败数</p><p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-app-text-strong">{stats.failed}</p></SurfaceCard>
      </section>

      <SurfaceCard>
        <div className="flex flex-wrap gap-3">
          <select value={actionType} onChange={(event) => setActionType(event.target.value as InteractionTask["actionType"])} className="app-input md:w-[180px]">
            <option value="LIKE">点赞</option>
            <option value="POST">转发</option>
            <option value="COMMENT">回复</option>
          </select>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <textarea value={targetInput} onChange={(event) => setTargetInput(event.target.value)} className="app-input min-h-[150px] resize-y py-3" placeholder={actionType === "COMMENT" ? "每行一个微博链接" : "目标链接"} />
          <div className="app-subpanel space-y-4">
            <div>
              <p className="text-sm text-app-text-muted">选择账号</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {accounts.map((account) => (
                  <label key={account.id} className={`app-option-card ${selectedAccounts.includes(account.id) ? "app-option-card-active" : ""}`}>
                    <input type="checkbox" checked={selectedAccounts.includes(account.id)} onChange={() => setSelectedAccounts((current) => current.includes(account.id) ? current.filter((id) => id !== account.id) : [...current, account.id])} />
                    <span>{account.nickname}</span>
                  </label>
                ))}
              </div>
            </div>

            {actionType === "COMMENT" ? (
              <div>
                <p className="text-sm text-app-text-muted">选择文案</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {contents.map((item) => (
                    <label key={item.id} className={`app-option-card ${selectedContentIds.includes(item.id) ? "app-option-card-active" : ""}`}>
                      <input type="checkbox" checked={selectedContentIds.includes(item.id)} onChange={() => setSelectedContentIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} />
                      <span>{item.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <button type="button" onClick={() => void createBatch()} disabled={submitting} className="app-button app-button-primary">
              创建互动任务
            </button>
          </div>
        </div>

        {error ? <AppNotice tone="error" className="mt-4">{error}</AppNotice> : null}
        {notice ? <AppNotice tone="success" className="mt-4">{notice}</AppNotice> : null}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader
          title="互动任务列表"
          description="按状态、动作和关键词快速筛选，并处理批量删除。"
          action={
            <div className="flex flex-wrap gap-3">
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} className="app-input md:w-[260px]" placeholder="搜索目标链接、账号或文案" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="app-input md:w-[180px]">
                <option value="ALL">全部状态</option>
                <option value="PENDING">待执行</option>
                <option value="READY">待确认</option>
                <option value="RUNNING">执行中</option>
                <option value="SUCCESS">成功</option>
                <option value="FAILED">失败</option>
                <option value="CANCELLED">已取消</option>
              </select>
              <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value as typeof actionFilter)} className="app-input md:w-[160px]">
                <option value="ALL">全部动作</option>
                <option value="LIKE">点赞</option>
                <option value="POST">转发</option>
                <option value="COMMENT">回复</option>
              </select>
              <button type="button" onClick={() => void refreshTasks()} className="app-button app-button-secondary">刷新</button>
              <button type="button" onClick={() => void batchDelete()} disabled={submitting} className="app-button app-button-secondary text-app-danger hover:border-app-danger/30 hover:text-app-danger">批量删除</button>
            </div>
          }
        />

        {filteredTasks.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="暂无互动任务" description="当前筛选下没有任务。你可以先创建一批，或者切换筛选条件。" />
          </div>
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[1280px]">
              <thead>
                <tr>
                  <th>选择</th>
                  <th>动作</th>
                  <th>账号</th>
                  <th>目标</th>
                  <th>文案</th>
                  <th>状态</th>
                  <th>结果</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <input type="checkbox" checked={selectedTaskIds.includes(task.id)} onChange={() => setSelectedTaskIds((current) => current.includes(task.id) ? current.filter((id) => id !== task.id) : [...current, task.id])} />
                    </td>
                    <td>{getActionText(task.actionType)}</td>
                    <td className="font-medium text-app-text-strong">{task.account.nickname}</td>
                    <td className="max-w-[280px] text-xs leading-6 text-app-text-muted">{task.target.targetUrl}</td>
                    <td>{task.content?.title || "-"}</td>
                    <td>
                      <StatusBadge tone={task.status === "SUCCESS" ? "success" : task.status === "FAILED" ? "danger" : task.status === "RUNNING" ? "info" : task.status === "CANCELLED" ? "warning" : task.status === "READY" ? "accent" : "neutral"}>
                        {getStatusText(task.status)}
                      </StatusBadge>
                    </td>
                    <td className="max-w-[220px] text-xs leading-6 text-app-text-soft">{task.resultMessage || formatDateTime(task.createdAt)}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => void runTaskAction(`/api/interaction-tasks/${task.id}/execute`, "任务已入队")} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs">执行</button>
                        <button type="button" onClick={() => void runTaskAction(`/api/interaction-tasks/${task.id}/approve`, "任务已确认")} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs">通过</button>
                        <button type="button" onClick={() => void runTaskAction(`/api/interaction-tasks/${task.id}/reject`, "任务已驳回")} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs">驳回</button>
                        <button type="button" onClick={() => void runTaskAction(`/api/interaction-tasks/${task.id}/stop`, "任务已停止")} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs">停止</button>
                        <button type="button" onClick={() => void deleteTask(task.id)} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs text-app-danger hover:border-app-danger/30 hover:text-app-danger">删除</button>
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
