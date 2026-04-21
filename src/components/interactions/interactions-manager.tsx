"use client";

import type { CopywritingTemplate, InteractionTarget, InteractionTask, WeiboAccount } from "@/generated/prisma/client";
import { InteractionResultPreview } from "@/components/interactions/interaction-result-preview";
import { InteractionTaskCard } from "@/components/interactions/interaction-task-card";
import { canManageBusinessData, canReviewAndExecuteTasks } from "@/lib/permission-rules";
import type { AppRole } from "@/lib/permission-rules";
import Link from "next/link";
import { FormEvent, useState } from "react";

type InteractionTaskWithRelations = InteractionTask & {
  account: {
    id: string;
    nickname: string;
  };
  target: InteractionTarget;
  content: CopywritingTemplate | null;
  isOwned: boolean;
};

type RawInteractionTask = InteractionTask & {
  account: {
    id: string;
    nickname: string;
    ownerUserId?: string;
  };
  target: InteractionTarget;
  content: CopywritingTemplate | null;
  isOwned?: boolean;
};

type InteractionStatus = "PENDING" | "READY" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
type InteractionActionType = "LIKE" | "POST" | "COMMENT";

const actionText: Record<InteractionActionType, string> = {
  LIKE: "点赞",
  POST: "转发",
  COMMENT: "回复",
};

function getActionText(actionType: string) {
  if (actionType === "LIKE" || actionType === "POST" || actionType === "COMMENT") {
    return actionText[actionType];
  }

  return actionType;
}

function summarizeContent(content: string, maxLength = 28) {
  const trimmed = content.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength)}...`;
}

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
  contents,
  currentUserId,
  currentUserRole,
  initialTasks,
}: {
  accounts: WeiboAccount[];
  contents: CopywritingTemplate[];
  currentUserId: string;
  currentUserRole: AppRole;
  initialTasks: InteractionTaskWithRelations[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [targetInput, setTargetInput] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);
  const [executorAccountId, setExecutorAccountId] = useState("");
  const [actionType, setActionType] = useState<InteractionActionType>("LIKE");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<InteractionStatus | "ALL">("ALL");
  const [actionFilter, setActionFilter] = useState<InteractionActionType | "ALL">("ALL");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [batchExecuting, setBatchExecuting] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canManage = canManageBusinessData(currentUserRole);
  const canExecute = canReviewAndExecuteTasks(currentUserRole);

  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = statusFilter === "ALL" || task.status === statusFilter;
    const matchesAction = actionFilter === "ALL" || task.actionType === actionFilter;
    const matchesKeyword =
      keyword.trim() === "" ||
      task.target.targetUrl.toLowerCase().includes(keyword.trim().toLowerCase()) ||
      task.account.nickname.toLowerCase().includes(keyword.trim().toLowerCase()) ||
      (task.content?.title || "").toLowerCase().includes(keyword.trim().toLowerCase());

    return matchesStatus && matchesAction && matchesKeyword;
  });

  function normalizeTask(task: RawInteractionTask): InteractionTaskWithRelations {
    const isOwned = typeof task.isOwned === "boolean" ? task.isOwned : task.account?.ownerUserId === currentUserId;

    return {
      ...task,
      isOwned,
      account: {
        id: task.account.id,
        nickname: isOwned ? task.account.nickname : "其他用户账号",
      },
    };
  }

  function toggleAccount(id: string) {
    setSelectedAccounts((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function selectAllAccounts() {
    setSelectedAccounts(accounts.map((account) => account.id));
  }

  function clearSelectedAccounts() {
    setSelectedAccounts([]);
  }

  function toggleContent(id: string) {
    setSelectedContentIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleTask(id: string) {
    setSelectedTaskIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectAllFilteredTasks() {
    setSelectedTaskIds(filteredTasks.map((task) => task.id));
  }

  function clearSelectedTasks() {
    setSelectedTaskIds([]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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

      setTasks((current) => [...(result.data as RawInteractionTask[]).map((item) => normalizeTask(item)), ...current]);
      setNotice(
        result.message ||
          (result.meta?.createdCount > 0
            ? `已创建 ${result.meta.createdCount} 条任务`
            : `未创建新任务${result.meta?.skippedDuplicateCount ? `，跳过 ${result.meta.skippedDuplicateCount} 条重复任务` : ""}`),
      );
      setTargetInput("");
      setSelectedAccounts([]);
      setSelectedContentIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建互动任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExecute(id: string) {
    try {
      setError(null);

      const task = tasks.find((item) => item.id === id);

      if (!task) {
        throw new Error("互动任务不存在");
      }

      if (!task.isOwned && !executorAccountId) {
        throw new Error("请先选择用于执行跨用户任务的账号");
      }

      const response = await fetch(`/api/interaction-tasks/${id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          executorAccountId: task.isOwned ? undefined : executorAccountId,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "执行互动任务失败");
      }

      setTasks((current) => current.map((item) => (item.id === id ? normalizeTask(result.data) : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "执行互动任务失败");
    }
  }

  async function handleBatchExecute() {
    const selectedSet = new Set(selectedTaskIds);
    const baseCandidates = selectedTaskIds.length > 0 ? filteredTasks.filter((task) => selectedSet.has(task.id)) : filteredTasks;
    const candidates = baseCandidates.filter((task) => task.status === "PENDING" || task.status === "READY" || task.status === "FAILED");

    if (candidates.length === 0) {
      setError("当前筛选下没有可执行或可重试的互动任务");
      return;
    }

    if (!window.confirm(`确认批量执行当前筛选的 ${candidates.length} 条互动任务吗？`)) {
      return;
    }

    try {
      setBatchExecuting(true);
      setError(null);
      setNotice(null);

      let success = 0;
      let failed = 0;
      let skippedLargeCommentCount = 0;

      for (const task of candidates) {
        try {
          if (!task.isOwned && !executorAccountId) {
            throw new Error("请先选择用于执行跨用户任务的账号");
          }

          const response = await fetch(`/api/interaction-tasks/${task.id}/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              executorAccountId: task.isOwned ? undefined : executorAccountId,
            }),
          });
          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.message || "执行互动任务失败");
          }

          if (typeof result.message === "string" && result.message.includes("已大于20条")) {
            skippedLargeCommentCount += 1;
          } else {
            success += 1;
          }

          setTasks((current) => current.map((item) => (item.id === task.id ? normalizeTask(result.data) : item)));
        } catch {
          failed += 1;
        }
      }

      const noticeParts = [`批量执行完成：成功 ${success} 条`];

      if (skippedLargeCommentCount > 0) {
        noticeParts.push(`超过 20 条已跳过 ${skippedLargeCommentCount} 条`);
      }

      if (failed > 0) {
        noticeParts.push(`失败 ${failed} 条`);
        setError(noticeParts.join("，"));
      } else {
        setNotice(noticeParts.join("，"));
      }
    } finally {
      setBatchExecuting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确认删除这条互动任务吗？")) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/interaction-tasks/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "删除互动任务失败");
      }

      setTasks((current) => current.filter((item) => item.id !== id));
      setSelectedTaskIds((current) => current.filter((taskId) => taskId !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除互动任务失败");
    }
  }

  async function handleBatchDelete() {
    const selectedSet = new Set(selectedTaskIds);
    const candidates = selectedTaskIds.length > 0 ? filteredTasks.filter((task) => selectedSet.has(task.id)) : filteredTasks;

    if (candidates.length === 0) {
      setError("当前筛选下没有可删除的互动任务");
      return;
    }

    if (!window.confirm(`确认删除 ${candidates.length} 条互动任务吗？`)) {
      return;
    }

    try {
      setBatchDeleting(true);
      setError(null);
      setNotice(null);

      const response = await fetch("/api/interaction-tasks/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: candidates.map((task) => task.id) }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "批量删除互动任务失败");
      }

      const deletedIds = new Set<string>(result.data.deletedIds || []);
      setTasks((current) => current.filter((task) => !deletedIds.has(task.id)));
      setSelectedTaskIds((current) => current.filter((taskId) => !deletedIds.has(taskId)));
      setNotice(
        result.message ||
          `已删除 ${result.data.deletedCount || 0} 条互动任务${result.data.skippedCount ? `，跳过 ${result.data.skippedCount} 条无权限任务` : ""}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量删除互动任务失败");
    } finally {
      setBatchDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">互动任务</h2>
        <p className="mt-1 text-sm text-slate-500">录入微博链接、评论直达链接或评论投诉链接，并为多个账号批量生成点赞或转发任务。</p>
        <p className="mt-2 text-sm">
          <Link href="/ops" className="text-sky-700 hover:text-sky-800">
            前往控评与轮转主入口
          </Link>
        </p>
        {notice ? <p className="mt-2 text-sm text-sky-700">{notice}</p> : null}
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
            <option value="COMMENT">回复</option>
          </select>
          {actionType === "COMMENT" ? (
            <textarea
              value={targetInput}
              onChange={(event) => setTargetInput(event.target.value)}
              rows={6}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              placeholder="一行一个微博详情链接"
            />
          ) : (
            <input
              value={targetInput}
              onChange={(event) => setTargetInput(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              placeholder="填写微博详情/评论直达/投诉链接"
            />
          )}

          {actionType === "COMMENT" ? (
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-700">选择回复文案</p>
              <p className="mt-1 text-xs text-slate-500">执行前会检查评论数；若已大于 20 条，则直接标记完成并备注“已大于20条”。同账号同微博的未完成回复任务会自动跳过，避免重复创建。</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {contents.map((content) => (
                  <label key={content.id} className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedContentIds.includes(content.id)}
                      onChange={() => toggleContent(content.id)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium text-slate-900">{content.title}</span>
                      <span className="mt-1 block text-xs text-slate-500">{content.content}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">选择参与账号</p>
              <div className="flex items-center gap-3 text-xs">
                <button type="button" onClick={selectAllAccounts} className="text-sky-700 hover:text-sky-800">
                  全选
                </button>
                <button type="button" onClick={clearSelectedAccounts} className="text-slate-600 hover:text-slate-700">
                  清空
                </button>
              </div>
            </div>
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
              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value as InteractionActionType | "ALL")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="ALL">全部动作</option>
                <option value="LIKE">点赞</option>
                <option value="POST">转发</option>
                <option value="COMMENT">回复</option>
              </select>
              {canExecute ? (
                <select
                  value={executorAccountId}
                  onChange={(event) => setExecutorAccountId(event.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">跨用户执行账号（必选）</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.nickname}
                    </option>
                  ))}
                </select>
              ) : null}
              {canExecute ? (
                <button
                  type="button"
                  onClick={handleBatchExecute}
                  disabled={batchExecuting}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {batchExecuting
                    ? "批量执行中..."
                    : selectedTaskIds.length > 0
                      ? `执行/重试选中 (${selectedTaskIds.length})`
                      : "执行/重试当前筛选"}
                </button>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  onClick={handleBatchDelete}
                  disabled={batchDeleting}
                  className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {batchDeleting ? "删除中..." : selectedTaskIds.length > 0 ? `删除选中 (${selectedTaskIds.length})` : "删除当前筛选"}
                </button>
              ) : null}
              {canExecute ? (
                <button
                  type="button"
                  onClick={selectAllFilteredTasks}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  全选当前筛选
                </button>
              ) : null}
              {canExecute ? (
                <button
                  type="button"
                  onClick={clearSelectedTasks}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  清空已选
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="space-y-4 p-4 md:hidden">
          {filteredTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">暂无互动任务。</div>
          ) : (
            filteredTasks.map((task) => (
              <InteractionTaskCard
                key={task.id}
                task={task}
                canExecute={canExecute}
                canManage={canManage}
                selected={selectedTaskIds.includes(task.id)}
                onToggle={() => toggleTask(task.id)}
                onExecute={() => handleExecute(task.id)}
                onDelete={() => handleDelete(task.id)}
              />
            ))
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {canExecute ? <th className="px-6 py-3 font-medium">选择</th> : null}
              <th className="px-6 py-3 font-medium">目标链接</th>
              <th className="px-6 py-3 font-medium">账号</th>
              <th className="px-6 py-3 font-medium">动作</th>
              <th className="px-6 py-3 font-medium">文案</th>
              <th className="px-6 py-3 font-medium">状态</th>
              <th className="px-6 py-3 font-medium">结果</th>
              <th className="px-6 py-3 font-medium">创建时间</th>
              <th className="px-6 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                 <td colSpan={canExecute ? 9 : 8} className="px-6 py-8 text-slate-500">
                   暂无互动任务。
                 </td>
              </tr>
            ) : (
              filteredTasks.map((task) => (
                <tr key={task.id} className="border-t border-slate-200">
                  {canExecute ? (
                    <td className="px-6 py-4">
                      <input type="checkbox" checked={selectedTaskIds.includes(task.id)} onChange={() => toggleTask(task.id)} />
                    </td>
                  ) : null}
                  <td className="px-6 py-4 text-sky-600">{task.target.targetUrl}</td>
                  <td className="px-6 py-4">{task.account.nickname}</td>
                  <td className="px-6 py-4">{getActionText(task.actionType)}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {task.content ? (
                      <div className="space-y-1">
                        <div className="font-medium text-slate-700">{task.content.title}</div>
                        <div className="text-xs text-slate-500">{summarizeContent(task.content.content)}</div>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-6 py-4">{statusText[task.status]}</td>
                  <td className="px-6 py-4 text-slate-600"><InteractionResultPreview result={task.resultMessage} /></td>
                  <td className="px-6 py-4">{new Date(task.createdAt).toLocaleString("zh-CN")}</td>
                  <td className="px-6 py-4">
                      {canExecute ? (
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => handleExecute(task.id)} className="text-violet-600 hover:text-violet-700">
                            执行
                          </button>
                          {canManage ? (
                            <button onClick={() => handleDelete(task.id)} className="text-rose-700 hover:text-rose-800">
                              删除
                            </button>
                          ) : null}
                        </div>
                      ) : task.isOwned ? (
                        <span className="text-slate-400">只读</span>
                      ) : (
                        <span className="text-slate-400">只读</span>
                      )}
                   </td>
                 </tr>
               ))
            )}
          </tbody>
        </table>
        </div>
      </section>
    </div>
  );
}
