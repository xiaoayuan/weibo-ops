"use client";

import { RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { useState } from "react";

import { AppNotice } from "@/components/app-notice";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";
import type { WeiboAccount } from "@/lib/app-data";
import { formatDateTime } from "@/lib/date";
import { readJsonResponse } from "@/lib/http";
import { getAccountStatusText, getLoginStatusText } from "@/lib/text";

type AccountStatus = "ACTIVE" | "DISABLED" | "RISKY" | "EXPIRED";

type FormState = {
  nickname: string;
  remark: string;
  groupName: string;
  status: AccountStatus;
  scheduleWindowEnabled: boolean;
  executionWindowStart: string;
  executionWindowEnd: string;
  baseJitterSec: number;
};

const initialForm: FormState = {
  nickname: "",
  remark: "",
  groupName: "",
  status: "ACTIVE",
  scheduleWindowEnabled: false,
  executionWindowStart: "",
  executionWindowEnd: "",
  baseJitterSec: 0,
};

type CheckSessionResult = {
  success: boolean;
  message?: string;
  data?: {
    id: string;
    loginStatus: WeiboAccount["loginStatus"];
    lastCheckAt: string | null;
    loginErrorMessage: string | null;
    consecutiveFailures: number;
  };
};

export function AccountsManager({ initialAccounts }: { initialAccounts: WeiboAccount[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onlineCount = accounts.filter((account) => account.loginStatus === "ONLINE").length;
  const riskyCount = accounts.filter((account) => account.status === "RISKY" || account.loginStatus === "FAILED").length;
  const proxyBoundCount = accounts.filter((account) => Boolean(account.proxyNodeId)).length;

  async function submitForm() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(editingId ? `/api/accounts/${editingId}` : "/api/accounts", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await readJsonResponse<{ success: boolean; message?: string; data: WeiboAccount }>(response);

      if (!response.ok) {
        throw new Error(result.message || (editingId ? "更新账号失败" : "新增账号失败"));
      }

      setAccounts((current) => (editingId ? current.map((item) => (item.id === editingId ? result.data : item)) : [result.data, ...current]));
      setNotice(result.message || (editingId ? "账号已更新" : "账号已创建"));
      setEditingId(null);
      setForm(initialForm);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : editingId ? "更新账号失败" : "新增账号失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function checkSession(id: string) {
    try {
      setCheckingId(id);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/accounts/${id}/check-session`, { method: "POST" });
      const result = await readJsonResponse<CheckSessionResult>(response);

      if (!response.ok) {
        throw new Error(result.message || "检测登录态失败");
      }

      if (result.data) {
        setAccounts((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...result.data,
                }
              : item,
          ),
        );
      }

      setNotice(result.message || "登录态检测完成");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "检测登录态失败");
    } finally {
      setCheckingId(null);
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        eyebrow="账号管理"
        title="账号状态、编辑和登录态检测已接入独立前端"
        description="这里现在不只是读取视图。你可以直接新增账号、编辑账号信息，并触发登录态检测，后续再继续补齐扫码登录和批量管理。"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="账号总数" value={String(accounts.length)} detail="当前用户可见账号" accent="accent" icon={<UserPlus className="h-5 w-5" />} />
        <StatCard label="登录在线" value={String(onlineCount)} detail="登录态检测为在线" accent="success" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="代理绑定" value={String(proxyBoundCount)} detail={`${riskyCount} 个账号需要关注`} accent={riskyCount > 0 ? "warning" : "info"} icon={<RefreshCw className="h-5 w-5" />} />
      </section>

      <SurfaceCard>
        <SectionHeader title={editingId ? "编辑账号" : "新增账号"} description="先补最常用的账号维护入口，避免新前端只能看不能管。" />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input value={form.nickname} onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))} className="app-input" placeholder="账号昵称" />
          <input value={form.groupName} onChange={(event) => setForm((current) => ({ ...current, groupName: event.target.value }))} className="app-input" placeholder="分组名称" />
          <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as AccountStatus }))} className="app-input">
            <option value="ACTIVE">正常</option>
            <option value="DISABLED">停用</option>
            <option value="RISKY">风险</option>
            <option value="EXPIRED">失效</option>
          </select>
          <input type="number" min={0} max={3600} value={form.baseJitterSec} onChange={(event) => setForm((current) => ({ ...current, baseJitterSec: Number(event.target.value) || 0 }))} className="app-input" placeholder="随机间隔秒" />
          <input value={form.remark} onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))} className="app-input md:col-span-2 xl:col-span-4" placeholder="备注" />
        </div>

        {error ? <AppNotice tone="error" className="mt-4">{error}</AppNotice> : null}
        {notice ? <AppNotice tone="success" className="mt-4">{notice}</AppNotice> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          {editingId ? (
            <button type="button" onClick={() => { setEditingId(null); setForm(initialForm); }} className="app-button app-button-secondary">
              取消编辑
            </button>
          ) : null}
          <button type="button" onClick={() => void submitForm()} disabled={submitting} className="app-button app-button-primary">
            {editingId ? "保存账号" : "新增账号"}
          </button>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader title="账号列表" description="读写基础能力已经接入，下面可以直接做账号编辑和登录态检测。" />

        {accounts.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="暂时没有账号" description="后端当前没有返回账号数据。你现在可以直接用上面的表单新增账号。" />
          </div>
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[1360px]">
              <thead>
                <tr>
                  <th>账号</th>
                  <th>分组 / UID</th>
                  <th>账号状态</th>
                  <th>登录状态</th>
                  <th>代理</th>
                  <th>最近检查</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <div>
                        <p className="font-medium text-app-text-strong">{account.nickname}</p>
                        <p className="mt-1 text-xs text-app-text-soft">{account.remark || account.username || "暂无备注"}</p>
                      </div>
                    </td>
                    <td>
                      <p>{account.groupName || "未分组"}</p>
                      <p className="mt-1 font-mono text-xs text-app-text-soft">{account.uid || "-"}</p>
                    </td>
                    <td>
                      <StatusBadge tone={account.status === "ACTIVE" ? "success" : account.status === "RISKY" ? "warning" : account.status === "EXPIRED" ? "danger" : "neutral"}>
                        {getAccountStatusText(account.status)}
                      </StatusBadge>
                    </td>
                    <td>
                      <StatusBadge tone={account.loginStatus === "ONLINE" ? "success" : account.loginStatus === "FAILED" ? "danger" : account.loginStatus === "EXPIRED" ? "warning" : "neutral"}>
                        {getLoginStatusText(account.loginStatus)}
                      </StatusBadge>
                      {account.loginErrorMessage ? <p className="mt-2 max-w-[220px] text-xs leading-5 text-app-text-soft">{account.loginErrorMessage}</p> : null}
                    </td>
                    <td>
                      <StatusBadge tone={account.proxyNodeId ? "accent" : "neutral"}>{account.proxyNodeId ? "已绑定代理" : "未绑定代理"}</StatusBadge>
                    </td>
                    <td className="text-xs text-app-text-soft">{account.lastCheckAt ? formatDateTime(account.lastCheckAt) : "未检测"}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(account.id);
                            setForm({
                              nickname: account.nickname,
                              remark: account.remark || "",
                              groupName: account.groupName || "",
                              status: account.status,
                              scheduleWindowEnabled: account.scheduleWindowEnabled,
                              executionWindowStart: account.executionWindowStart || "",
                              executionWindowEnd: account.executionWindowEnd || "",
                              baseJitterSec: account.baseJitterSec,
                            });
                          }}
                          className="app-button app-button-secondary h-10 px-4 text-xs"
                        >
                          编辑
                        </button>
                        <button type="button" onClick={() => void checkSession(account.id)} disabled={checkingId === account.id} className="app-button app-button-secondary h-10 px-4 text-xs">
                          {checkingId === account.id ? "检测中" : "检测登录态"}
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
