"use client";

import type { InviteCode, UserRole } from "@/generated/prisma/client";
import { FormEvent, useState } from "react";

type UserListItem = {
  id: string;
  username: string;
  role: UserRole;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type FormState = {
  username: string;
  password: string;
  role: UserRole;
};

type EditState = {
  password: string;
  role: UserRole;
};

type InviteCodeFormState = {
  role: "VIEWER" | "OPERATOR";
  maxUses: number;
  expiresInHours: number;
};

const initialForm: FormState = {
  username: "",
  password: "",
  role: "OPERATOR",
};

const roleText: Record<UserRole, string> = {
  ADMIN: "管理员",
  OPERATOR: "运营",
  VIEWER: "只读",
};

export function UsersManager({
  initialUsers,
  initialInviteCodes,
}: {
  initialUsers: UserListItem[];
  initialInviteCodes: InviteCode[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>(initialInviteCodes);
  const [form, setForm] = useState<FormState>(initialForm);
  const [inviteForm, setInviteForm] = useState<InviteCodeFormState>({ role: "VIEWER", maxUses: 1, expiresInHours: 48 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ password: "", role: "OPERATOR" });
  const [pageNowTs] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateInviteCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch("/api/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "生成注册码失败");
      }

      setInviteCodes((current) => [result.data, ...current]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成注册码失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleInviteCode(id: string, disabled: boolean) {
    try {
      setError(null);

      const response = await fetch(`/api/invite-codes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "更新注册码失败");
      }

      setInviteCodes((current) => current.map((item) => (item.id === id ? result.data : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新注册码失败");
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "创建用户失败");
      }

      setUsers((current) => [result.data, ...current]);
      setForm(initialForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建用户失败");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(user: UserListItem) {
    setEditingId(user.id);
    setEditState({ password: "", role: user.role });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState({ password: "", role: "OPERATOR" });
    setError(null);
  }

  async function handleUpdate(id: string) {
    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editState),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "更新用户失败");
      }

      setUsers((current) => current.map((item) => (item.id === id ? result.data : item)));
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新用户失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确认删除这个用户吗？")) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "删除用户失败");
      }

      setUsers((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除用户失败");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">用户管理</h2>
        <p className="mt-1 text-sm text-slate-500">仅管理员可管理后台用户和角色权限。</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-medium">注册码管理</h3>
        <form className="mt-4 grid gap-4 md:grid-cols-4" onSubmit={handleCreateInviteCode}>
          <select
            value={inviteForm.role}
            onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value as InviteCodeFormState["role"] }))}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="VIEWER">只读</option>
            <option value="OPERATOR">运营</option>
          </select>
          <input
            type="number"
            min={1}
            max={100}
            value={inviteForm.maxUses}
            onChange={(event) => setInviteForm((current) => ({ ...current, maxUses: Number(event.target.value) || 1 }))}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="可用次数"
          />
          <input
            type="number"
            min={1}
            max={720}
            value={inviteForm.expiresInHours}
            onChange={(event) => setInviteForm((current) => ({ ...current, expiresInHours: Number(event.target.value) || 48 }))}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="有效小时"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "生成中..." : "生成注册码"}
          </button>
        </form>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">注册码</th>
                <th className="px-4 py-2 font-medium">角色</th>
                <th className="px-4 py-2 font-medium">次数</th>
                <th className="px-4 py-2 font-medium">过期时间</th>
                <th className="px-4 py-2 font-medium">状态</th>
                <th className="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {inviteCodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-slate-500">
                    暂无注册码，先生成一条。
                  </td>
                </tr>
              ) : (
                inviteCodes.map((item) => {
                  const expired = Boolean(item.expiresAt && new Date(item.expiresAt).getTime() <= pageNowTs);
                  const exhausted = item.usedCount >= item.maxUses;
                  const disabled = item.disabled;
                  const statusText = disabled ? "已禁用" : exhausted ? "已用尽" : expired ? "已过期" : "可用";

                  return (
                    <tr key={item.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{item.code}</td>
                      <td className="px-4 py-3">{item.role === "OPERATOR" ? "运营" : "只读"}</td>
                      <td className="px-4 py-3">{item.usedCount}/{item.maxUses}</td>
                      <td className="px-4 py-3">{item.expiresAt ? new Date(item.expiresAt).toLocaleString("zh-CN") : "-"}</td>
                      <td className="px-4 py-3">{statusText}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleInviteCode(item.id, !item.disabled)}
                          className="text-sky-700 hover:text-sky-800"
                        >
                          {item.disabled ? "启用" : "禁用"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-medium">新增用户</h3>
        <form className="mt-4 grid gap-4 md:grid-cols-3" onSubmit={handleCreate}>
          <input
            value={form.username}
            onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="用户名"
          />
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="密码至少 6 位"
          />
          <select
            value={form.role}
            onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="ADMIN">管理员</option>
            <option value="OPERATOR">运营</option>
            <option value="VIEWER">只读</option>
          </select>
          <div className="md:col-span-3 flex items-center justify-between gap-3">
            {error ? <p className="text-sm text-rose-600">{error}</p> : <div />}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "提交中..." : "新增用户"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">用户名</th>
              <th className="px-6 py-3 font-medium">角色</th>
              <th className="px-6 py-3 font-medium">创建时间</th>
              <th className="px-6 py-3 font-medium">更新时间</th>
              <th className="px-6 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isEditing = editingId === user.id;

              return (
                <tr key={user.id} className="border-t border-slate-200 align-top">
                  <td className="px-6 py-4">{user.username}</td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <select
                        value={editState.role}
                        onChange={(event) => setEditState((current) => ({ ...current, role: event.target.value as UserRole }))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                      >
                        <option value="ADMIN">管理员</option>
                        <option value="OPERATOR">运营</option>
                        <option value="VIEWER">只读</option>
                      </select>
                    ) : (
                      roleText[user.role]
                    )}
                  </td>
                  <td className="px-6 py-4">{new Date(user.createdAt).toLocaleString("zh-CN")}</td>
                  <td className="px-6 py-4">{new Date(user.updatedAt).toLocaleString("zh-CN")}</td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <div className="flex flex-wrap gap-3">
                        <input
                          type="password"
                          value={editState.password}
                          onChange={(event) => setEditState((current) => ({ ...current, password: event.target.value }))}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                          placeholder="留空则不修改密码"
                        />
                        <button onClick={() => handleUpdate(user.id)} className="text-sky-600 hover:text-sky-700">
                          保存
                        </button>
                        <button onClick={cancelEdit} className="text-slate-600 hover:text-slate-700">
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        <button onClick={() => startEdit(user)} className="text-sky-600 hover:text-sky-700">
                          编辑角色
                        </button>
                        <button onClick={() => handleDelete(user.id)} className="text-rose-600 hover:text-rose-700">
                          删除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
