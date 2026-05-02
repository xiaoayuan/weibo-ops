"use client";

import { useState } from "react";

import { AppNotice } from "@/components/app-notice";
import type { InviteCode, UserListItem } from "@/lib/app-data";
import { formatDateTime } from "@/lib/date";
import { getRoleText } from "@/lib/text";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";

type UserForm = {
  username: string;
  password: string;
  role: "ADMIN" | "OPERATOR" | "VIEWER";
};

type InviteForm = {
  role: "VIEWER" | "OPERATOR";
  maxUses: number;
  expiresInHours: number;
};

export function UsersManager({
  initialUsers,
  initialInviteCodes,
}: {
  initialUsers: UserListItem[];
  initialInviteCodes: InviteCode[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [inviteCodes, setInviteCodes] = useState(initialInviteCodes);
  const [form, setForm] = useState<UserForm>({ username: "", password: "", role: "OPERATOR" });
  const [inviteForm, setInviteForm] = useState<InviteForm>({ role: "VIEWER", maxUses: 1, expiresInHours: 48 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserForm["role"]>("OPERATOR");
  const [editPassword, setEditPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pageNowTs] = useState(() => Date.now());

  async function createInviteCode() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

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
      setNotice("注册码已生成");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成注册码失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleInviteCode(item: InviteCode) {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/invite-codes/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: !item.disabled }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "更新注册码失败");
      }

      setInviteCodes((current) => current.map((code) => (code.id === item.id ? result.data : code)));
      setNotice("注册码状态已更新");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "更新注册码失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function createUser() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

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
      setForm({ username: "", password: "", role: "OPERATOR" });
      setNotice("用户已创建");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建用户失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateUser(id: string) {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editRole, password: editPassword }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "更新用户失败");
      }

      setUsers((current) => current.map((item) => (item.id === id ? result.data : item)));
      setEditingId(null);
      setEditPassword("");
      setNotice("用户已更新");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "更新用户失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteUser(id: string) {
    if (!window.confirm("确认删除这个用户吗？")) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "删除用户失败");
      }

      setUsers((current) => current.filter((item) => item.id !== id));
      setNotice(result.message || "用户已删除");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除用户失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader eyebrow="用户管理" title="用户与邀请码管理" description="管理团队成员、分配权限、生成和管理邀请码。" />

      <SurfaceCard>
        <SectionHeader title="注册码管理" />
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <select value={inviteForm.role} onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value as InviteForm["role"] }))} className="app-input h-12">
            <option value="VIEWER">只读</option>
            <option value="OPERATOR">运营</option>
          </select>
          <input type="number" min={1} max={100} value={inviteForm.maxUses} onChange={(event) => setInviteForm((current) => ({ ...current, maxUses: Number(event.target.value) || 1 }))} className="app-input h-12" placeholder="可用次数" />
          <input type="number" min={1} max={720} value={inviteForm.expiresInHours} onChange={(event) => setInviteForm((current) => ({ ...current, expiresInHours: Number(event.target.value) || 48 }))} className="app-input h-12" placeholder="有效小时" />
          <button type="button" onClick={() => void createInviteCode()} disabled={submitting} className="app-button app-button-primary justify-center">
            生成注册码
          </button>
        </div>

        {error ? <AppNotice tone="error" className="mt-4">{error}</AppNotice> : null}
        {notice ? <AppNotice tone="success" className="mt-4">{notice}</AppNotice> : null}

        {inviteCodes.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="暂无注册码" description="先创建一条邀请码，给新的后台成员使用。" />
          </div>
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[980px]">
              <thead>
                <tr>
                  <th>注册码</th>
                  <th>角色</th>
                  <th>次数</th>
                  <th>过期时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {inviteCodes.map((item) => {
                  const expired = Boolean(item.expiresAt && new Date(item.expiresAt).getTime() <= pageNowTs);
                  const exhausted = item.usedCount >= item.maxUses;
                  const statusText = item.disabled ? "已禁用" : exhausted ? "已用尽" : expired ? "已过期" : "可用";

                  return (
                    <tr key={item.id}>
                      <td className="font-mono text-xs text-app-text-strong">{item.code}</td>
                      <td>{getRoleText(item.role)}</td>
                      <td>{item.usedCount}/{item.maxUses}</td>
                      <td>{item.expiresAt ? formatDateTime(item.expiresAt) : "-"}</td>
                      <td>
                        <StatusBadge tone={item.disabled || expired || exhausted ? "warning" : "success"}>{statusText}</StatusBadge>
                      </td>
                      <td>
                        <button type="button" onClick={() => void toggleInviteCode(item)} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs">
                          {item.disabled ? "启用" : "禁用"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableShell>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader title="新增用户" />
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} className="app-input h-12" placeholder="用户名" />
          <input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="app-input h-12" placeholder="密码至少 6 位" />
          <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserForm["role"] }))} className="app-input h-12">
            <option value="ADMIN">管理员</option>
            <option value="OPERATOR">运营</option>
            <option value="VIEWER">只读</option>
          </select>
          <button type="button" onClick={() => void createUser()} disabled={submitting} className="app-button app-button-primary justify-center">
            新增用户
          </button>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        {users.length === 0 ? (
          <EmptyState title="暂无用户" description="还没有用户数据。" />
        ) : (
          <TableShell>
            <table className="app-table min-w-[1080px]">
              <thead>
                <tr>
                  <th>用户名</th>
                  <th>角色</th>
                  <th>创建时间</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isEditing = editingId === user.id;

                  return (
                    <tr key={user.id}>
                      <td className="font-medium text-app-text-strong">{user.username}</td>
                      <td>
                        {isEditing ? (
                          <select value={editRole} onChange={(event) => setEditRole(event.target.value as UserForm["role"])} className="app-input h-11 w-[140px]">
                            <option value="ADMIN">管理员</option>
                            <option value="OPERATOR">运营</option>
                            <option value="VIEWER">只读</option>
                          </select>
                        ) : (
                          getRoleText(user.role)
                        )}
                      </td>
                      <td>{formatDateTime(user.createdAt)}</td>
                      <td>{formatDateTime(user.updatedAt)}</td>
                      <td>
                        {isEditing ? (
                          <div className="flex flex-wrap gap-2">
                            <input type="password" value={editPassword} onChange={(event) => setEditPassword(event.target.value)} className="app-input h-11 w-[200px]" placeholder="新密码（可留空）" />
                            <button type="button" onClick={() => void updateUser(user.id)} disabled={submitting} className="app-button app-button-primary h-10 px-4 text-xs">
                              保存
                            </button>
                            <button type="button" onClick={() => { setEditingId(null); setEditPassword(""); }} className="app-button app-button-secondary h-10 px-4 text-xs">
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(user.id);
                                setEditRole(user.role);
                                setEditPassword("");
                              }}
                              className="app-button app-button-secondary h-10 px-4 text-xs"
                            >
                              编辑
                            </button>
                            <button type="button" onClick={() => void deleteUser(user.id)} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs text-app-danger hover:border-app-danger/30 hover:text-app-danger">
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
          </TableShell>
        )}
      </SurfaceCard>
    </div>
  );
}
