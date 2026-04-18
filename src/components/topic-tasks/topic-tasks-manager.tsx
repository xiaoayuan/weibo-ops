"use client";

import type { AccountTopicTask, SuperTopic, WeiboAccount } from "@/generated/prisma/client";
import { canManageBusinessData } from "@/lib/permission-rules";
import type { AppRole } from "@/lib/permission-rules";
import { FormEvent, useState } from "react";

type TaskWithRelations = AccountTopicTask & {
  account: WeiboAccount;
  superTopic: SuperTopic;
};

type FormState = {
  accountId: string;
  superTopicId: string;
  signEnabled: boolean;
  postEnabled: boolean;
  minPostsPerDay: number;
  maxPostsPerDay: number;
  startTime: string;
  endTime: string;
  status: boolean;
};

export function TopicTasksManager({
  initialTasks,
  accounts,
  topics,
  currentUserRole,
}: {
  initialTasks: TaskWithRelations[];
  accounts: WeiboAccount[];
  topics: SuperTopic[];
  currentUserRole: AppRole;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DISABLED">("ALL");
  const [form, setForm] = useState<FormState>({
    accountId: accounts[0]?.id || "",
    superTopicId: topics[0]?.id || "",
    signEnabled: true,
    postEnabled: true,
    minPostsPerDay: 4,
    maxPostsPerDay: 6,
    startTime: "09:00",
    endTime: "22:00",
    status: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = canManageBusinessData(currentUserRole);

  const filteredTasks = tasks.filter((task) => {
    const matchesKeyword =
      keyword.trim() === "" ||
      task.account.nickname.toLowerCase().includes(keyword.trim().toLowerCase()) ||
      task.superTopic.name.toLowerCase().includes(keyword.trim().toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || (statusFilter === "ACTIVE" ? task.status : !task.status);

    return matchesKeyword && matchesStatus;
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(editingId ? `/api/topic-tasks/${editingId}` : "/api/topic-tasks", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "创建任务失败");
      }

      setTasks((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? result.data : item))
          : [result.data, ...current],
      );
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId ? "更新任务失败" : "创建任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(task: TaskWithRelations) {
    setEditingId(task.id);
    setForm({
      accountId: task.accountId,
      superTopicId: task.superTopicId,
      signEnabled: task.signEnabled,
      postEnabled: task.postEnabled,
      minPostsPerDay: task.minPostsPerDay,
      maxPostsPerDay: task.maxPostsPerDay,
      startTime: task.startTime || "09:00",
      endTime: task.endTime || "22:00",
      status: task.status,
    });
    setError(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm({
      accountId: accounts[0]?.id || "",
      superTopicId: topics[0]?.id || "",
      signEnabled: true,
      postEnabled: true,
      minPostsPerDay: 4,
      maxPostsPerDay: 6,
      startTime: "09:00",
      endTime: "22:00",
      status: true,
    });
    setError(null);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确认删除这条任务配置吗？")) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/topic-tasks/${id}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "删除任务失败");
      }

      setTasks((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除任务失败");
    }
  }

  async function handleToggleStatus(task: TaskWithRelations) {
    try {
      setError(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "切换状态失败");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">任务配置</h2>
        <p className="mt-1 text-sm text-slate-500">为账号绑定超话，并分别配置签到任务与发帖任务。</p>
      </div>

      {canManage ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium">{editingId ? "编辑任务" : "新增任务"}</h3>
          {accounts.length === 0 || topics.length === 0 ? (
            <p className="mt-4 text-sm text-amber-600">请先创建账号和超话，再配置任务。</p>
          ) : (
            <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <select
              value={form.accountId}
              onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.nickname}
                </option>
              ))}
            </select>
            <select
              value={form.superTopicId}
              onChange={(event) => setForm((current) => ({ ...current, superTopicId: event.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              >
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>

            <div className="rounded-lg border border-slate-200 p-4 text-sm md:col-span-2">
              <p className="font-medium text-slate-700">签到任务</p>
              <label className="mt-3 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.signEnabled}
                  onChange={(event) => setForm((current) => ({ ...current, signEnabled: event.target.checked }))}
                />
                启用签到任务
              </label>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 text-sm md:col-span-2">
              <p className="font-medium text-slate-700">发帖任务</p>
              <label className="mt-3 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.postEnabled}
                  onChange={(event) => setForm((current) => ({ ...current, postEnabled: event.target.checked }))}
                />
                启用发帖任务
              </label>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  type="number"
                  value={form.minPostsPerDay}
                  onChange={(event) => setForm((current) => ({ ...current, minPostsPerDay: Number(event.target.value) }))}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                  placeholder="最小发帖数"
                  disabled={!form.postEnabled}
                />
                <input
                  type="number"
                  value={form.maxPostsPerDay}
                  onChange={(event) => setForm((current) => ({ ...current, maxPostsPerDay: Number(event.target.value) }))}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                  placeholder="最大发帖数"
                  disabled={!form.postEnabled}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.checked }))}
              />
              启用该任务
            </label>
            <input
              type="time"
              value={form.startTime}
              onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            />
            <input
              type="time"
              value={form.endTime}
              onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            />
            <div className="md:col-span-2 flex items-center justify-between gap-3">
              {error ? <p className="text-sm text-rose-600">{error}</p> : <div />}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "提交中..." : editingId ? "保存修改" : "新增任务"}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    取消编辑
                  </button>
                ) : null}
              </div>
            </div>
            </form>
          )}
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
                placeholder="搜索账号或超话"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "DISABLED")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="ALL">全部状态</option>
                <option value="ACTIVE">仅启用</option>
                <option value="DISABLED">仅停用</option>
              </select>
            </div>
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">账号</th>
              <th className="px-6 py-3 font-medium">超话</th>
              <th className="px-6 py-3 font-medium">签到任务</th>
              <th className="px-6 py-3 font-medium">发帖任务</th>
              <th className="px-6 py-3 font-medium">发帖频次</th>
              <th className="px-6 py-3 font-medium">时间窗口</th>
              <th className="px-6 py-3 font-medium">状态</th>
                {canManage ? <th className="px-6 py-3 font-medium">操作</th> : null}
             </tr>
           </thead>
           <tbody>
             {filteredTasks.length === 0 ? (
               <tr>
                  <td colSpan={canManage ? 8 : 7} className="px-6 py-8 text-slate-500">
                    暂无任务配置。
                  </td>
                </tr>
            ) : (
              filteredTasks.map((task) => (
                <tr key={task.id} className="border-t border-slate-200">
                  <td className="px-6 py-4">{task.account.nickname}</td>
                  <td className="px-6 py-4">{task.superTopic.name}</td>
                  <td className="px-6 py-4">{task.signEnabled ? "已启用" : "未启用"}</td>
                  <td className="px-6 py-4">{task.postEnabled ? "已启用" : "未启用"}</td>
                  <td className="px-6 py-4">{task.postEnabled ? `${task.minPostsPerDay}-${task.maxPostsPerDay}` : "-"}</td>
                  <td className="px-6 py-4">{task.startTime || "09:00"} - {task.endTime || "22:00"}</td>
                  <td className="px-6 py-4">{task.status ? "启用" : "停用"}</td>
                   {canManage ? (
                     <td className="px-6 py-4">
                       <button onClick={() => handleEdit(task)} className="mr-4 text-sky-600 hover:text-sky-700">
                         编辑
                       </button>
                       <button
                         onClick={() => handleToggleStatus(task)}
                         className="mr-4 text-amber-600 hover:text-amber-700"
                       >
                         {task.status ? "停用" : "启用"}
                       </button>
                       <button onClick={() => handleDelete(task.id)} className="text-rose-600 hover:text-rose-700">
                         删除
                       </button>
                     </td>
                   ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
