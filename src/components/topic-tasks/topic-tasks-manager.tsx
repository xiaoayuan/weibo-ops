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
  function extractValidationMessage(result: unknown, fallback: string) {
    if (!result || typeof result !== "object") {
      return fallback;
    }

    const record = result as Record<string, unknown>;
    const errors = record.errors as
      | {
          formErrors?: string[];
          fieldErrors?: Record<string, string[] | undefined>;
        }
      | undefined;

    if (errors?.formErrors && errors.formErrors.length > 0) {
      return errors.formErrors[0];
    }

    if (errors?.fieldErrors) {
      for (const fieldError of Object.values(errors.fieldErrors)) {
        if (Array.isArray(fieldError) && fieldError.length > 0) {
          return fieldError[0];
        }
      }
    }

    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }

    return fallback;
  }

  const [tasks, setTasks] = useState(initialTasks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DISABLED">("ALL");
  const [form, setForm] = useState<FormState>({
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
        body: JSON.stringify({
          ...(editingId
            ? { ...form, accountIds: undefined }
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
                postEnabled: false,
                minPostsPerDay: 0,
                maxPostsPerDay: 0,
                startTime: form.startTime,
                endTime: form.endTime,
                status: form.status,
              }),
          firstCommentEnabled: form.firstCommentEnabled,
          firstCommentPerDay: form.firstCommentPerDay,
          firstCommentIntervalSec: form.firstCommentIntervalSec,
          likePerDay: form.likePerDay,
          likeIntervalSec: form.likeIntervalSec,
          repostPerDay: form.repostPerDay,
          repostIntervalSec: form.repostIntervalSec,
          commentPerDay: form.commentPerDay,
          commentIntervalSec: form.commentIntervalSec,
          postEnabled: false,
          minPostsPerDay: 0,
          maxPostsPerDay: 0,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(extractValidationMessage(result, "创建任务失败"));
      }

      setTasks((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? result.data : item))
          : [...(result.data || []), ...current],
      );
      setEditingId(null);
      setForm((current) => ({
        ...current,
        accountIds: accounts[0]?.id ? [accounts[0].id] : [],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId ? "更新任务失败" : "创建任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(task: TaskWithRelations) {
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
      startTime: task.startTime || "09:00",
      endTime: task.endTime || "22:00",
      status: task.status,
    });
    setError(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm({
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
      startTime: "09:00",
      endTime: "22:00",
      status: true,
    });
    setError(null);
  }

  function toggleCreateAccount(accountId: string) {
    setForm((current) => {
      if (current.accountIds.includes(accountId)) {
        return {
          ...current,
          accountIds: current.accountIds.filter((id) => id !== accountId),
        };
      }

      return {
        ...current,
        accountIds: [...current.accountIds, accountId],
      };
    });
  }

  function selectAllCreateAccounts() {
    setForm((current) => ({
      ...current,
      accountIds: accounts.map((account) => account.id),
    }));
  }

  function clearCreateAccounts() {
    setForm((current) => ({
      ...current,
      accountIds: [],
    }));
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
        <p className="mt-1 text-sm text-slate-500">为账号绑定超话并配置签到任务，互动动作在互动任务页单独管理。</p>
      </div>

      {canManage ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium">{editingId ? "编辑任务" : "新增任务"}</h3>
          {accounts.length === 0 || topics.length === 0 ? (
            <p className="mt-4 text-sm text-amber-600">请先创建账号和超话，再配置任务。</p>
          ) : (
            <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            {editingId ? (
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
            ) : (
              <div className="rounded-lg border border-slate-200 p-4 text-sm md:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-700">选择账号（可多选）</p>
                  <div className="flex items-center gap-3 text-xs">
                    <button type="button" onClick={selectAllCreateAccounts} className="text-sky-700 hover:text-sky-800">
                      全选
                    </button>
                    <button type="button" onClick={clearCreateAccounts} className="text-slate-600 hover:text-slate-700">
                      清空
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {accounts.map((account) => (
                    <label key={account.id} className="inline-flex items-center gap-2 text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.accountIds.includes(account.id)}
                        onChange={() => toggleCreateAccount(account.id)}
                      />
                      {account.nickname}
                    </label>
                  ))}
                </div>
              </div>
            )}
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
              <p className="font-medium text-slate-700">首评任务</p>
              <label className="mt-3 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.firstCommentEnabled}
                  onChange={(event) => setForm((current) => ({ ...current, firstCommentEnabled: event.target.checked }))}
                />
                启用首评任务
              </label>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.firstCommentPerDay}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      firstCommentPerDay: Number(event.target.value) || 4,
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                />
                <p className="text-xs text-slate-500">每天首评条数，默认 4；文案将自动从文案库的“首评文案”标签随机抽取。</p>
                <input
                  type="number"
                  min={60}
                  max={86400}
                  value={form.firstCommentIntervalSec}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      firstCommentIntervalSec: Number(event.target.value) || 1800,
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                />
                <p className="text-xs text-slate-500">首评最小间隔（秒），默认 1800 秒。</p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 text-sm md:col-span-2">
              <p className="font-medium text-slate-700">互动频次（每日自动生成）</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-xs text-slate-500">点赞次数/天</span>
                  <input type="number" min={0} max={300} value={form.likePerDay} onChange={(event) => setForm((current) => ({ ...current, likePerDay: Number(event.target.value) || 0 }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-500">转发次数/天</span>
                  <input type="number" min={0} max={200} value={form.repostPerDay} onChange={(event) => setForm((current) => ({ ...current, repostPerDay: Number(event.target.value) || 0 }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-500">回复次数/天</span>
                  <input type="number" min={0} max={100} value={form.commentPerDay} onChange={(event) => setForm((current) => ({ ...current, commentPerDay: Number(event.target.value) || 0 }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-500">点赞间隔（秒）</span>
                  <input type="number" min={30} max={86400} value={form.likeIntervalSec} onChange={(event) => setForm((current) => ({ ...current, likeIntervalSec: Number(event.target.value) || 1200 }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-500">转发间隔（秒）</span>
                  <input type="number" min={60} max={86400} value={form.repostIntervalSec} onChange={(event) => setForm((current) => ({ ...current, repostIntervalSec: Number(event.target.value) || 1800 }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-500">回复间隔（秒）</span>
                  <input type="number" min={60} max={86400} value={form.commentIntervalSec} onChange={(event) => setForm((current) => ({ ...current, commentIntervalSec: Number(event.target.value) || 1800 }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400" />
                </label>
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
          {canManage ? <p className="mt-4 text-xs text-slate-500">首评文案请在文案库中维护，并打上标签 `首评文案`。</p> : null}
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">账号</th>
              <th className="px-6 py-3 font-medium">超话</th>
              <th className="px-6 py-3 font-medium">签到任务</th>
              <th className="px-6 py-3 font-medium">首评任务</th>
               <th className="px-6 py-3 font-medium">互动设置</th>
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
                  <td className="px-6 py-4">{task.firstCommentEnabled ? `已启用 / ${task.firstCommentPerDay} 条` : "未启用"}</td>
                   <td className="px-6 py-4">赞{task.likePerDay}/转{task.repostPerDay}/评{task.commentPerDay}</td>
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
