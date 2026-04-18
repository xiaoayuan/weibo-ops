"use client";

import type { WeiboAccount } from "@/generated/prisma/client";
import { canManageBusinessData } from "@/lib/permission-rules";
import type { AppRole } from "@/lib/permission-rules";
import { FormEvent, useMemo, useState } from "react";

type AccountStatus = "ACTIVE" | "DISABLED" | "RISKY" | "EXPIRED";
type AccountLoginStatus = "UNKNOWN" | "ONLINE" | "EXPIRED" | "FAILED";

type FormState = {
  nickname: string;
  remark: string;
  groupName: string;
  status: AccountStatus;
};

type SessionFormState = {
  uid: string;
  username: string;
  cookie: string;
};

const initialForm: FormState = {
  nickname: "",
  remark: "",
  groupName: "",
  status: "ACTIVE",
};

const initialSessionForm: SessionFormState = {
  uid: "",
  username: "",
  cookie: "",
};

const statusText: Record<AccountStatus, string> = {
  ACTIVE: "正常",
  DISABLED: "停用",
  RISKY: "风险",
  EXPIRED: "失效",
};

const loginStatusText: Record<AccountLoginStatus, string> = {
  UNKNOWN: "未检测",
  ONLINE: "在线",
  EXPIRED: "已过期",
  FAILED: "检测失败",
};

export function AccountsManager({ currentUserRole, initialAccounts }: { currentUserRole: AppRole; initialAccounts: WeiboAccount[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [form, setForm] = useState<FormState>(initialForm);
  const [sessionForm, setSessionForm] = useState<SessionFormState>(initialSessionForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sessionEditingId, setSessionEditingId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [sessionSubmitting, setSessionSubmitting] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = canManageBusinessData(currentUserRole);

  const groupOptions = useMemo(
    () => Array.from(new Set(accounts.map((account) => account.groupName?.trim()).filter(Boolean))) as string[],
    [accounts],
  );

  const filteredAccounts = accounts.filter((account) => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const matchesKeyword =
      normalizedKeyword === "" ||
      account.nickname.toLowerCase().includes(normalizedKeyword) ||
      (account.remark || "").toLowerCase().includes(normalizedKeyword) ||
      (account.username || "").toLowerCase().includes(normalizedKeyword) ||
      (account.uid || "").toLowerCase().includes(normalizedKeyword);
    const matchesGroup = groupFilter === "ALL" || (account.groupName || "") === groupFilter;

    return matchesKeyword && matchesGroup;
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(editingId ? `/api/accounts/${editingId}` : "/api/accounts", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "新增账号失败");
      }

      setForm(initialForm);
      setEditingId(null);

      setAccounts((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? result.data : item))
          : [result.data, ...current],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId ? "更新账号失败" : "新增账号失败");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(account: WeiboAccount) {
    setEditingId(account.id);
    setForm({
      nickname: account.nickname,
      remark: account.remark || "",
      groupName: account.groupName || "",
      status: account.status,
    });
    setError(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setError(null);
  }

  function handleOpenSessionForm(account: WeiboAccount) {
    setSessionEditingId(account.id);
    setSessionForm({
      uid: account.uid || "",
      username: account.username || "",
      cookie: "",
    });
    setError(null);
  }

  function handleCancelSessionEdit() {
    setSessionEditingId(null);
    setSessionForm(initialSessionForm);
    setError(null);
  }

  async function handleSessionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sessionEditingId) {
      return;
    }

    try {
      setSessionSubmitting(true);
      setError(null);

      const response = await fetch(`/api/accounts/${sessionEditingId}/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sessionForm),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "保存 Cookie 失败");
      }

      setAccounts((current) =>
        current.map((item) =>
          item.id === sessionEditingId
            ? {
                ...item,
                uid: result.data.uid,
                username: result.data.username,
                loginStatus: result.data.loginStatus,
                cookieUpdatedAt: result.data.cookieUpdatedAt,
                loginErrorMessage: null,
                consecutiveFailures: 0,
              }
            : item,
        ),
      );

      handleCancelSessionEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存 Cookie 失败");
    } finally {
      setSessionSubmitting(false);
    }
  }

  async function handleCheckSession(id: string) {
    try {
      setCheckingId(id);
      setError(null);

      const response = await fetch(`/api/accounts/${id}/check-session`, {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "检测登录态失败");
      }

      setAccounts((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                loginStatus: result.data.loginStatus,
                lastCheckAt: result.data.lastCheckAt,
                loginErrorMessage: result.data.loginErrorMessage,
                consecutiveFailures: result.data.consecutiveFailures,
              }
            : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "检测登录态失败");
    } finally {
      setCheckingId(null);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("确认删除这个账号吗？");

    if (!confirmed) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/accounts/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "删除账号失败");
      }

      setAccounts((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除账号失败");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">账号管理</h2>
        <p className="mt-1 text-sm text-slate-500">管理微博账号、分组、登录态和检测状态。</p>
      </div>

      {canManage ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium">{editingId ? "编辑账号" : "新增账号"}</h3>

          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">账号昵称</label>
            <input
              value={form.nickname}
              onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              placeholder="请输入账号昵称"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">分组</label>
            <input
              value={form.groupName}
              onChange={(event) => setForm((current) => ({ ...current, groupName: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              placeholder="默认分组"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">备注</label>
            <input
              value={form.remark}
              onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              placeholder="例如：娱乐组"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">状态</label>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value as AccountStatus }))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="ACTIVE">正常</option>
              <option value="DISABLED">停用</option>
              <option value="RISKY">风险</option>
              <option value="EXPIRED">失效</option>
            </select>
          </div>

          <div className="md:col-span-2 flex items-center justify-between gap-3">
            {error ? <p className="text-sm text-rose-600">{error}</p> : <div />}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "提交中..." : editingId ? "保存修改" : "新增账号"}
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
        </section>
      ) : null}

      {canManage && sessionEditingId ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium">录入微博 Cookie</h3>
          <form className="mt-4 grid gap-4" onSubmit={handleSessionSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">微博 UID</label>
                <input
                  value={sessionForm.uid}
                  onChange={(event) => setSessionForm((current) => ({ ...current, uid: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                  placeholder="请输入微博 UID"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">微博用户名</label>
                <input
                  value={sessionForm.username}
                  onChange={(event) => setSessionForm((current) => ({ ...current, username: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                  placeholder="请输入微博用户名"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Cookie</label>
              <textarea
                value={sessionForm.cookie}
                onChange={(event) => setSessionForm((current) => ({ ...current, cookie: event.target.value }))}
                className="min-h-36 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                placeholder="粘贴完整的微博 Cookie"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={sessionSubmitting}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sessionSubmitting ? "保存中..." : "保存 Cookie"}
              </button>
              <button
                type="button"
                onClick={handleCancelSessionEdit}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                取消
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h3 className="text-lg font-medium">账号列表</h3>
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索昵称、备注、微博用户名或 UID"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
              />
              <select
                value={groupFilter}
                onChange={(event) => setGroupFilter(event.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="ALL">全部分组</option>
                {groupOptions.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredAccounts.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-500">暂无账号，先新增一条账号记录。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">账号昵称</th>
                  <th className="px-6 py-3 font-medium">微博用户名</th>
                  <th className="px-6 py-3 font-medium">UID</th>
                  <th className="px-6 py-3 font-medium">分组</th>
                  <th className="px-6 py-3 font-medium">登录状态</th>
                  <th className="px-6 py-3 font-medium">最近检测</th>
                  <th className="px-6 py-3 font-medium">错误信息</th>
                  {canManage ? <th className="px-6 py-3 font-medium">操作</th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account) => (
                  <tr key={account.id} className="border-t border-slate-200 align-top">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{account.nickname}</div>
                      <div className="mt-1 text-xs text-slate-500">{statusText[account.status]} / 风险 {account.riskLevel}</div>
                    </td>
                    <td className="px-6 py-4">{account.username || "-"}</td>
                    <td className="px-6 py-4">{account.uid || "-"}</td>
                    <td className="px-6 py-4">{account.groupName || "-"}</td>
                    <td className="px-6 py-4">{loginStatusText[account.loginStatus]}</td>
                    <td className="px-6 py-4">
                      {account.lastCheckAt ? new Date(account.lastCheckAt).toLocaleString("zh-CN") : "-"}
                    </td>
                    <td className="max-w-xs px-6 py-4 text-slate-600">{account.loginErrorMessage || "-"}</td>
                    {canManage ? (
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => handleEdit(account)}
                            className="text-sm text-sky-600 transition hover:text-sky-700"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleOpenSessionForm(account)}
                            className="text-sm text-indigo-600 transition hover:text-indigo-700"
                          >
                            录入 Cookie
                          </button>
                          <button
                            onClick={() => handleCheckSession(account.id)}
                            disabled={checkingId === account.id}
                            className="text-sm text-emerald-600 transition hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {checkingId === account.id ? "检测中..." : "检测登录态"}
                          </button>
                          <button
                            onClick={() => handleDelete(account.id)}
                            className="text-sm text-rose-600 transition hover:text-rose-700"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
