"use client";

import { useState } from "react";

import type { InviteCode } from "@/lib/app-data";
import { AppNotice } from "@/components/app-notice";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { readJsonResponse } from "@/lib/http";
import { SectionHeader } from "@/components/section-header";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";

type CreateForm = {
  role: "VIEWER" | "OPERATOR";
  maxUses: number;
  expiresInHours: number;
};

function createDefaultForm(): CreateForm {
  return {
    role: "VIEWER",
    maxUses: 1,
    expiresInHours: 168,
  };
}

export function InviteCodesManager({ initialCodes }: { initialCodes: InviteCode[] }) {
  const [codes, setCodes] = useState<InviteCode[]>(initialCodes);
  const [form, setForm] = useState<CreateForm>(createDefaultForm());
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (form.maxUses < 1 || form.maxUses > 100) {
      setError("使用次数需在 1-100 之间");
      return;
    }

    if (form.expiresInHours < 1 || form.expiresInHours > 720) {
      setError("过期小时数需在 1-720 之间");
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch("/api/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: form.role,
          maxUses: form.maxUses,
          expiresInHours: form.expiresInHours,
        }),
      });
      const result = await readJsonResponse<{ success: boolean; message?: string; data: InviteCode }>(response);

      if (!response.ok || !result.success) {
        throw new Error(result.message || "生成失败");
      }

      setCodes((current) => [result.data, ...current]);
      setNotice(result.message || "邀请码已生成");
      setForm(createDefaultForm());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(id: string, currentDisabled: boolean) {
    setError(null);
    setNotice(null);

    try {
      setTogglingId(id);
      const response = await fetch(`/api/invite-codes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: !currentDisabled }),
      });
      const result = await readJsonResponse<{ success: boolean; message?: string }>(response);

      if (!response.ok || !result.success) {
        throw new Error(result.message || "操作失败");
      }

      setCodes((current) =>
        current.map((code) => (code.id === id ? { ...code, disabled: !currentDisabled } : code)),
      );
      setNotice(result.message || (currentDisabled ? "已启用" : "已禁用"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "操作失败");
    } finally {
      setTogglingId(null);
    }
  }

  function formatExpiresAt(iso: string | null): string {
    if (!iso) return "永久有效";
    const d = new Date(iso);
    return d.toLocaleString("zh-CN");
  }

  function isExpired(iso: string | null): boolean {
    if (!iso) return false;
    return new Date(iso) < new Date();
  }

  function remaining(code: InviteCode): string {
    if (isExpired(code.expiresAt)) return "已过期";
    const rem = code.maxUses - code.usedCount;
    return `${rem} / ${code.maxUses}`;
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="邀请码管理"
        description="邀请码用于新用户自助注册，可控制角色、可用次数和有效期。"
      />

      <SurfaceCard className="rounded-[24px] p-6">
        <SectionHeader title="生成邀请码" description="设置角色、可用次数和过期时间。" />
        <form onSubmit={(e) => void handleCreate(e)} className="mt-5 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-app-text-soft">角色</label>
              <select
                value={form.role}
                onChange={(e) => setForm((current) => ({ ...current, role: e.target.value as CreateForm["role"] }))}
                className="app-input h-12 w-[160px]"
              >
                <option value="VIEWER">只读（VIEWER）</option>
                <option value="OPERATOR">运营（OPERATOR）</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-app-text-soft">最大使用次数</label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.maxUses}
                onChange={(e) => setForm((current) => ({ ...current, maxUses: Number(e.target.value) || 1 }))}
                className="app-input h-12 w-[160px]"
                placeholder="1-100"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-app-text-soft">过期小时数</label>
              <input
                type="number"
                min={1}
                max={720}
                value={form.expiresInHours}
                onChange={(e) => setForm((current) => ({ ...current, expiresInHours: Number(e.target.value) || 1 }))}
                className="app-input h-12 w-[160px]"
                placeholder="1-720"
              />
            </div>

            <button type="submit" disabled={submitting} className="app-button app-button-primary h-12 px-6">
              {submitting ? "生成中…" : "生成"}
            </button>
          </div>

          {error ? <AppNotice tone="error">{error}</AppNotice> : null}
          {notice ? <AppNotice tone="success">{notice}</AppNotice> : null}
        </form>
      </SurfaceCard>

      <SurfaceCard className="rounded-[24px] p-6">
        <SectionHeader title="邀请码列表" description={`共 ${codes.length} 条记录`} />
        {codes.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="暂无邀请码" description="使用上方表单生成第一个邀请码。" />
          </div>
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[960px]">
              <thead>
                <tr>
                  <th>邀请码</th>
                  <th>角色</th>
                  <th>剩余次数</th>
                  <th>过期时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => {
                  const expired = isExpired(code.expiresAt);

                  return (
                    <tr key={code.id}>
                      <td>
                        <p className="font-mono font-medium text-app-text-strong">{code.code}</p>
                      </td>
                      <td>
                        <StatusBadge tone={code.role === "OPERATOR" ? "info" : "neutral"}>
                          {code.role}
                        </StatusBadge>
                      </td>
                      <td className="text-sm text-app-text-muted">{remaining(code)}</td>
                      <td>
                        <span className={expired ? "text-app-danger" : "text-app-text-muted"}>
                          {formatExpiresAt(code.expiresAt)}
                        </span>
                      </td>
                      <td>
                        {expired ? (
                          <StatusBadge tone="danger">已过期</StatusBadge>
                        ) : code.disabled ? (
                          <StatusBadge tone="neutral">已禁用</StatusBadge>
                        ) : (
                          <StatusBadge tone="success">正常</StatusBadge>
                        )}
                      </td>
                      <td>
                        {expired ? null : (
                          <button
                            type="button"
                            onClick={() => void handleToggle(code.id, code.disabled)}
                            disabled={togglingId === code.id}
                            className="app-button h-9 px-4 text-xs"
                          >
                            {togglingId === code.id ? "处理中…" : code.disabled ? "启用" : "禁用"}
                          </button>
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
