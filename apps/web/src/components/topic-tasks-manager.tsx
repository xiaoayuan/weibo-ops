"use client";

import { useMemo, useState } from "react";

import { AppNotice } from "@/components/app-notice";
import type { SuperTopic, TopicTask, WeiboAccount } from "@/lib/app-data";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";

type FormState = {
  accountIds: string[];
  accountId: string;
  superTopicId: string;
  signEnabled: boolean;
  firstCommentEnabled: boolean;
  firstCommentPerDay: number;
  firstCommentIntervalSec: number;
  likePerDay: number;
  likeIntervalSec: number;
  repostPerDay: number;
  repostIntervalSec: number;
  commentPerDay: number;
  commentIntervalSec: number;
  postEnabled: boolean;
  minPostsPerDay: number;
  maxPostsPerDay: number;
  startTime: string;
  endTime: string;
  status: boolean;
};

function createInitialForm(accounts: WeiboAccount[], topics: SuperTopic[]): FormState {
  return {
    accountIds: accounts[0]?.id ? [accounts[0].id] : [],
    accountId: accounts[0]?.id || "",
    superTopicId: topics[0]?.id || "",
    signEnabled: true,
    firstCommentEnabled: false,
    firstCommentPerDay: 4,
    firstCommentIntervalSec: 1800,
    likePerDay: 0,
    likeIntervalSec: 1200,
    repostPerDay: 0,
    repostIntervalSec: 1800,
    commentPerDay: 0,
    commentIntervalSec: 1800,
    postEnabled: false,
    minPostsPerDay: 0,
    maxPostsPerDay: 0,
    startTime: "01:00",
    endTime: "18:00",
    status: true,
  };
}

export function TopicTasksManager({
  initialTasks,
  accounts,
  topics,
}: {
  initialTasks: TopicTask[];
  accounts: WeiboAccount[];
  topics: SuperTopic[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DISABLED">("ALL");
  const [form, setForm] = useState<FormState>(() => createInitialForm(accounts, topics));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesKeyword =
        normalizedKeyword === "" ||
        task.account.nickname.toLowerCase().includes(normalizedKeyword) ||
        task.superTopic.name.toLowerCase().includes(normalizedKeyword);
      const matchesStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" ? task.status : !task.status);

      return matchesKeyword && matchesStatus;
    });
  }, [keyword, statusFilter, tasks]);

  function resetForm() {
    setEditingId(null);
    setForm(createInitialForm(accounts, topics));
  }

  async function submitForm() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const payload = editingId
        ? {
            accountId: form.accountId,
            superTopicId: form.superTopicId,
            signEnabled: form.signEnabled,
            firstCommentEnabled: form.firstCommentEnabled,
            firstCommentPerDay: form.firstCommentPerDay,
            firstCommentIntervalSec: form.firstCommentIntervalSec,
            likePerDay: form.likePerDay,
            likeIntervalSec: form.likeIntervalSec,
            repostPerDay: form.repostPerDay,
            repostIntervalSec: form.repostIntervalSec,
            commentPerDay: form.commentPerDay,
            commentIntervalSec: form.commentIntervalSec,
            postEnabled: form.postEnabled,
            minPostsPerDay: form.minPostsPerDay,
            maxPostsPerDay: form.maxPostsPerDay,
            startTime: form.startTime,
            endTime: form.endTime,
            status: form.status,
          }
        : {
            accountIds: form.accountIds,
            superTopicId: form.superTopicId,
            signEnabled: form.signEnabled,
            firstCommentEnabled: form.firstCommentEnabled,
            firstCommentPerDay: form.firstCommentPerDay,
            firstCommentIntervalSec: form.firstCommentIntervalSec,
            likePerDay: form.likePerDay,
            likeIntervalSec: form.likeIntervalSec,
            repostPerDay: form.repostPerDay,
            repostIntervalSec: form.repostIntervalSec,
            commentPerDay: form.commentPerDay,
            commentIntervalSec: form.commentIntervalSec,
            postEnabled: form.postEnabled,
            minPostsPerDay: form.minPostsPerDay,
            maxPostsPerDay: form.maxPostsPerDay,
            startTime: form.startTime,
            endTime: form.endTime,
            status: form.status,
          };

      const response = await fetch(editingId ? `/api/topic-tasks/${editingId}` : "/api/topic-tasks", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || (editingId ? "更新任务失败" : "创建任务失败"));
      }

      setTasks((current) => (editingId ? current.map((item) => (item.id === editingId ? result.data : item)) : [...(result.data || []), ...current]));
      setNotice(result.message || (editingId ? "任务已更新" : "任务已创建"));
      resetForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : editingId ? "更新任务失败" : "创建任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeTask(id: string) {
    if (!window.confirm("确认删除这条任务配置吗？")) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/topic-tasks/${id}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "删除任务失败");
      }

      setTasks((current) => current.filter((item) => item.id !== id));
      setNotice(result.message || "删除成功");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(task: TopicTask) {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/topic-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: !task.status }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "切换状态失败");
      }

      setTasks((current) => current.map((item) => (item.id === task.id ? result.data : item)));
      setNotice("状态已更新");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "切换状态失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader title="账号与超话任务配置" description="为账号批量绑定超话和执行规则，支持创建、编辑、启停和删除。" />

      <SurfaceCard>
        <SectionHeader title={editingId ? "编辑任务" : "新增任务"} description="配置签到、首评、点赞、转发、回复等任务参数。" />

        {accounts.length === 0 || topics.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="请先准备账号和超话" description="至少需要一个账号和一个超话才能创建任务配置。" />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {editingId ? (
              <select value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))} className="app-input h-12">
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.nickname}
                  </option>
                ))}
              </select>
            ) : (
              <div className="app-subpanel md:col-span-2 xl:col-span-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-medium text-app-text-strong">选择账号（可多选）</p>
                  <div className="flex gap-2 text-xs">
                    <button type="button" onClick={() => setForm((current) => ({ ...current, accountIds: accounts.map((account) => account.id) }))} className="app-button app-button-secondary h-9 px-3 text-xs">
                      全选
                    </button>
                    <button type="button" onClick={() => setForm((current) => ({ ...current, accountIds: [] }))} className="app-button app-button-secondary h-9 px-3 text-xs">
                      清空
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {accounts.map((account) => {
                    const selected = form.accountIds.includes(account.id);

                    return (
                      <label key={account.id} className={`app-option-card ${selected ? "app-option-card-active" : ""}`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            setForm((current) => ({
                              ...current,
                              accountIds: current.accountIds.includes(account.id)
                                ? current.accountIds.filter((id) => id !== account.id)
                                : [...current.accountIds, account.id],
                            }))
                          }
                        />
                        <span>{account.nickname}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <select value={form.superTopicId} onChange={(event) => setForm((current) => ({ ...current, superTopicId: event.target.value }))} className="app-input h-12">
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
            <input type="time" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} className="app-input h-12" />
            <input type="time" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} className="app-input h-12" />

            <label className="app-option-card">
              <input type="checkbox" checked={form.signEnabled} onChange={(event) => setForm((current) => ({ ...current, signEnabled: event.target.checked }))} />
              签到启用
            </label>
            <label className="app-option-card">
              <input type="checkbox" checked={form.firstCommentEnabled} onChange={(event) => setForm((current) => ({ ...current, firstCommentEnabled: event.target.checked }))} />
              首评启用
            </label>
            <label className="app-option-card">
              <input type="checkbox" checked={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.checked }))} />
              配置启用
            </label>

            <input type="number" min={1} max={10} value={form.firstCommentPerDay} onChange={(event) => setForm((current) => ({ ...current, firstCommentPerDay: Number(event.target.value) || 1 }))} className="app-input h-12" placeholder="首评/天" />
            <input type="number" min={60} max={86400} value={form.firstCommentIntervalSec} onChange={(event) => setForm((current) => ({ ...current, firstCommentIntervalSec: Number(event.target.value) || 60 }))} className="app-input h-12" placeholder="首评间隔秒" />
            <input type="number" min={0} max={300} value={form.likePerDay} onChange={(event) => setForm((current) => ({ ...current, likePerDay: Number(event.target.value) || 0 }))} className="app-input h-12" placeholder="点赞/天" />
            <input type="number" min={30} max={86400} value={form.likeIntervalSec} onChange={(event) => setForm((current) => ({ ...current, likeIntervalSec: Number(event.target.value) || 30 }))} className="app-input h-12" placeholder="点赞间隔秒" />
            <input type="number" min={0} max={200} value={form.repostPerDay} onChange={(event) => setForm((current) => ({ ...current, repostPerDay: Number(event.target.value) || 0 }))} className="app-input h-12" placeholder="转发/天" />
            <input type="number" min={60} max={86400} value={form.repostIntervalSec} onChange={(event) => setForm((current) => ({ ...current, repostIntervalSec: Number(event.target.value) || 60 }))} className="app-input h-12" placeholder="转发间隔秒" />
            <label className="app-option-card">
              <input type="checkbox" checked={form.postEnabled} onChange={(event) => setForm((current) => ({ ...current, postEnabled: event.target.checked }))} />
              发帖启用
            </label>
            <input type="number" min={0} max={50} value={form.minPostsPerDay} onChange={(event) => setForm((current) => ({ ...current, minPostsPerDay: Number(event.target.value) || 0 }))} className="app-input h-12" placeholder="最少发帖/天" />
            <input type="number" min={0} max={50} value={form.maxPostsPerDay} onChange={(event) => setForm((current) => ({ ...current, maxPostsPerDay: Number(event.target.value) || 0 }))} className="app-input h-12" placeholder="最多发帖/天" />
            <input type="number" min={0} max={100} value={form.commentPerDay} onChange={(event) => setForm((current) => ({ ...current, commentPerDay: Number(event.target.value) || 0 }))} className="app-input h-12" placeholder="回复/天" />
            <input type="number" min={60} max={86400} value={form.commentIntervalSec} onChange={(event) => setForm((current) => ({ ...current, commentIntervalSec: Number(event.target.value) || 60 }))} className="app-input h-12" placeholder="回复间隔秒" />
          </div>
        )}

        {error ? <AppNotice tone="error" className="mt-4">{error}</AppNotice> : null}
        {notice ? <AppNotice tone="success" className="mt-4">{notice}</AppNotice> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          {editingId ? (
            <button type="button" onClick={resetForm} className="app-button app-button-secondary">
              取消编辑
            </button>
          ) : null}
          <button type="button" onClick={() => void submitForm()} disabled={submitting} className="app-button app-button-primary">
            {submitting ? "提交中..." : editingId ? "保存任务" : "创建任务"}
          </button>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader
          title="任务配置列表"
          action={
            <div className="flex flex-wrap items-center gap-3">
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} className="app-input h-12 max-w-sm" placeholder="搜索账号昵称或超话" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "DISABLED")} className="app-input h-12 w-[180px]">
                <option value="ALL">全部状态</option>
                <option value="ACTIVE">启用</option>
                <option value="DISABLED">停用</option>
              </select>
            </div>
          }
        />

        {filteredTasks.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="没有任务配置" description="你可以先创建一批配置，或者切换筛选条件查看已有任务。" />
          </div>
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[1280px]">
              <thead>
                <tr>
                  <th>账号 / 超话</th>
                  <th>窗口</th>
                  <th>任务强度</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <p className="font-medium text-app-text-strong">{task.account.nickname}</p>
                      <p className="mt-1 text-xs text-app-text-soft">{task.superTopic.name}</p>
                    </td>
                    <td className="font-mono text-xs text-app-text-soft">{task.startTime || "01:00"} - {task.endTime || "18:00"}</td>
                    <td className="text-xs leading-6 text-app-text-soft">
                      首评 {task.firstCommentPerDay}/天 · 点赞 {task.likePerDay}/天 · 转发 {task.repostPerDay}/天 · 回复 {task.commentPerDay}/天
                    </td>
                    <td>
                      <StatusBadge tone={task.status ? "success" : "neutral"}>{task.status ? "启用" : "停用"}</StatusBadge>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(task.id);
                            setForm({
                              accountIds: [task.accountId],
                              accountId: task.accountId,
                              superTopicId: task.superTopicId,
                              signEnabled: task.signEnabled,
                              firstCommentEnabled: task.firstCommentEnabled,
                              firstCommentPerDay: task.firstCommentPerDay,
                              firstCommentIntervalSec: task.firstCommentIntervalSec,
                              likePerDay: task.likePerDay,
                              likeIntervalSec: task.likeIntervalSec,
                              repostPerDay: task.repostPerDay,
                              repostIntervalSec: task.repostIntervalSec,
                              commentPerDay: task.commentPerDay,
                              commentIntervalSec: task.commentIntervalSec,
                              postEnabled: task.postEnabled,
                              minPostsPerDay: task.minPostsPerDay,
                              maxPostsPerDay: task.maxPostsPerDay,
                              startTime: task.startTime || "01:00",
                              endTime: task.endTime || "18:00",
                              status: task.status,
                            });
                          }}
                          className="app-button app-button-secondary h-10 px-4 text-xs"
                        >
                          编辑
                        </button>
                        <button type="button" onClick={() => void toggleStatus(task)} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs">
                          {task.status ? "停用" : "启用"}
                        </button>
                        <button type="button" onClick={() => void removeTask(task.id)} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs text-app-danger hover:border-app-danger/30 hover:text-app-danger">
                          删除
                        </button>
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
