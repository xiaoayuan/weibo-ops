"use client";

import Image from "next/image";
import { RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

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

type SessionFormState = {
  uid: string;
  username: string;
  cookie: string;
};

type QrLoginState = "WAITING" | "SCANNED" | "CONFIRMED" | "EXPIRED" | "FAILED";

type QrSession = {
  sessionId: string;
  state: QrLoginState;
  qrImageDataUrl: string;
  expiresAt: string;
  message?: string;
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

type CreateAccountResult = {
  success: boolean;
  message?: string;
  data: WeiboAccount;
};

type SaveSessionResult = {
  success: boolean;
  message?: string;
  data?: {
    id: string;
    uid: string | null;
    username: string | null;
    loginStatus: WeiboAccount["loginStatus"];
    cookieUpdatedAt: string | null;
  };
};

type QrStartResult = {
  success: boolean;
  message?: string;
  data?: QrSession;
};

type QrStatusResult = {
  success: boolean;
  message?: string;
  data?: {
    sessionId: string;
    state: QrLoginState;
    expiresAt: string;
    message?: string;
    persisted?: boolean;
    account?: Pick<WeiboAccount, "id" | "nickname" | "uid" | "username" | "loginStatus" | "cookieUpdatedAt" | "lastCheckAt" | "loginErrorMessage" | "consecutiveFailures">;
  };
};

function summarizeSessionCheckMessage(result: CheckSessionResult) {
  if (result.success) {
    return "登录态有效";
  }

  return result.message || "检测登录态失败";
}

export function AccountsManager({ initialAccounts }: { initialAccounts: WeiboAccount[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sessionEditingId, setSessionEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [sessionForm, setSessionForm] = useState<SessionFormState>({ uid: "", username: "", cookie: "" });
  const [submitting, setSubmitting] = useState(false);
  const [sessionSubmitting, setSessionSubmitting] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrAccountId, setQrAccountId] = useState<string | null>(null);
  const [qrSession, setQrSession] = useState<QrSession | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [bulkChecking, setBulkChecking] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onlineCount = accounts.filter((account) => account.loginStatus === "ONLINE").length;
  const riskyCount = accounts.filter((account) => account.status === "RISKY" || account.loginStatus === "FAILED").length;
  const proxyBoundCount = accounts.filter((account) => Boolean(account.proxyNodeId)).length;

  useEffect(() => {
    if (!qrAccountId || !qrSession || ["CONFIRMED", "EXPIRED", "FAILED"].includes(qrSession.state)) {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/accounts/${qrAccountId}/session/qr/status?sessionId=${encodeURIComponent(qrSession.sessionId)}`, {
          cache: "no-store",
        });
        const result = await readJsonResponse<QrStatusResult>(response);

        if (!response.ok || !result.data) {
          throw new Error(result.message || "查询扫码状态失败");
        }

        setQrSession((current) =>
          current
            ? {
                ...current,
                state: result.data?.state || current.state,
                expiresAt: result.data?.expiresAt || current.expiresAt,
                message: result.data?.message || current.message,
              }
            : current,
        );

        if (result.data.state === "CONFIRMED" && result.data.account) {
          setAccounts((current) => current.map((item) => (item.id === qrAccountId ? { ...item, ...result.data?.account } : item)));
          setNotice(result.message || "扫码登录完成并已保存 Cookie");
          setQrAccountId(null);
          setQrSession(null);
          setForm(initialForm);
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "查询扫码状态失败");
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [qrAccountId, qrSession]);

  async function startQrLogin(accountId: string) {
    try {
      setQrLoading(true);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/accounts/${accountId}/session/qr/start`, { method: "POST" });
      const result = await readJsonResponse<QrStartResult>(response);

      if (!response.ok) {
        throw new Error(result.message || "生成扫码二维码失败");
      }

      if (!result.data) {
        throw new Error("生成扫码二维码失败");
      }

      setQrAccountId(accountId);
      setQrSession({
        sessionId: result.data.sessionId,
        state: result.data.state,
        qrImageDataUrl: result.data.qrImageDataUrl,
        expiresAt: result.data.expiresAt,
        message: "等待扫码",
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成扫码二维码失败");
    } finally {
      setQrLoading(false);
    }
  }

  async function submitForm(startQrAfterCreate = false) {
    const isCreating = !editingId;
    const createNickname = form.nickname.trim() || "未命名账号";

    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(editingId ? `/api/accounts/${editingId}` : "/api/accounts", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          nickname: isCreating ? createNickname : form.nickname,
        }),
      });
      const result = await readJsonResponse<CreateAccountResult>(response);

      if (!response.ok) {
        throw new Error(result.message || (editingId ? "更新账号失败" : "新增账号失败"));
      }

      setAccounts((current) => (editingId ? current.map((item) => (item.id === editingId ? result.data : item)) : [result.data, ...current]));
      setNotice(result.message || (editingId ? "账号已更新" : startQrAfterCreate ? "账号已创建，等待扫码登录" : "账号已创建"));
      setEditingId(null);

      if (isCreating && startQrAfterCreate) {
        await startQrLogin(result.data.id);
        return;
      }

      setForm(initialForm);
      setSessionEditingId(null);
      setSessionForm({ uid: "", username: "", cookie: "" });
      setQrAccountId(null);
      setQrSession(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : editingId ? "更新账号失败" : "新增账号失败");
    } finally {
      setSubmitting(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setSessionEditingId(null);
    setSessionForm({ uid: "", username: "", cookie: "" });
    setQrAccountId(null);
    setQrSession(null);
    setError(null);
  }

  function openSessionEditor(account: WeiboAccount) {
    setSessionEditingId(account.id);
    setSessionForm({
      uid: account.uid || "",
      username: account.username || "",
      cookie: "",
    });
    setQrAccountId(null);
    setQrSession(null);
    setError(null);
    setNotice(null);
  }

  async function saveSession() {
    if (!sessionEditingId) {
      return;
    }

    if (!sessionForm.cookie.trim()) {
      setError("请粘贴 Cookie / Session 内容");
      return;
    }

    try {
      setSessionSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/accounts/${sessionEditingId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionForm),
      });
      const result = await readJsonResponse<SaveSessionResult>(response);

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || "保存登录态失败");
      }

      setAccounts((current) =>
        current.map((item) =>
          item.id === sessionEditingId
            ? {
                ...item,
                uid: result.data?.uid || item.uid,
                username: result.data?.username || item.username,
                loginStatus: result.data?.loginStatus || item.loginStatus,
                cookieUpdatedAt: result.data?.cookieUpdatedAt || item.cookieUpdatedAt,
              }
            : item,
        ),
      );
      setSessionForm((current) => ({ ...current, cookie: "" }));
      setNotice(result.message || "登录态已保存");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存登录态失败");
    } finally {
      setSessionSubmitting(false);
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

      setNotice(summarizeSessionCheckMessage(result));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "检测登录态失败");
    } finally {
      setCheckingId(null);
    }
  }

  async function checkAllSessions() {
    if (accounts.length === 0) {
      setError("当前没有可检测账号");
      return;
    }

    try {
      setBulkChecking(true);
      setError(null);
      setNotice(null);

      let successCount = 0;

      for (const account of accounts) {
        const response = await fetch(`/api/accounts/${account.id}/check-session`, { method: "POST" });
        const result = await readJsonResponse<CheckSessionResult>(response);

        if (response.ok && result.data) {
          successCount += 1;
          setAccounts((current) =>
            current.map((item) => (item.id === account.id ? { ...item, ...result.data } : item)),
          );
        }
      }

      setNotice(`已完成 ${accounts.length} 个账号登录态检测，其中 ${successCount} 个请求成功返回`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "批量检测登录态失败");
    } finally {
      setBulkChecking(false);
    }
  }

  async function deleteAccount(id: string) {
    if (!window.confirm("确认删除这个账号吗？删除后无法恢复。")) {
      return;
    }

    try {
      setDeletingId(id);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      const result = await readJsonResponse<{ success: boolean; message?: string }>(response);

      if (!response.ok || !result.success) {
        throw new Error(result.message || "删除账号失败");
      }

      setAccounts((current) => current.filter((item) => item.id !== id));
      setNotice(result.message || "账号已删除");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除账号失败");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        eyebrow="账号管理"
        title="微博账号管理"
        description="管理微博账号、检测登录状态、配置代理绑定。"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="账号总数" value={String(accounts.length)} detail="当前用户可见账号" accent="accent" icon={<UserPlus className="h-5 w-5" />} />
        <StatCard label="登录在线" value={String(onlineCount)} detail="登录态检测为在线" accent="success" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="代理绑定" value={String(proxyBoundCount)} detail={`${riskyCount} 个账号需要关注`} accent={riskyCount > 0 ? "warning" : "info"} icon={<RefreshCw className="h-5 w-5" />} />
      </section>

      <SurfaceCard>
        <SectionHeader title={editingId ? "编辑账号" : "新增账号"} description="先补最常用的账号维护入口，避免新前端只能看不能管。新增账号时也可以直接进入扫码登录。" />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input value={form.nickname} onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))} className="app-input" placeholder="账号昵称，留空则自动用未命名账号占位" />
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
        {sessionEditingId ? (
          <div className="mt-4 rounded-[24px] border border-app-line bg-app-panel-muted p-5">
            <p className="text-sm font-semibold text-app-text-strong">手动录入 Session / Cookie</p>
            <p className="mt-2 text-sm text-app-text-soft">当扫码不可用时，可以直接录入账号的 UID、用户名和 Cookie。</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input value={sessionForm.uid} onChange={(event) => setSessionForm((current) => ({ ...current, uid: event.target.value }))} className="app-input h-12" placeholder="UID（可选）" />
              <input value={sessionForm.username} onChange={(event) => setSessionForm((current) => ({ ...current, username: event.target.value }))} className="app-input h-12" placeholder="用户名（可选）" />
              <textarea value={sessionForm.cookie} onChange={(event) => setSessionForm((current) => ({ ...current, cookie: event.target.value }))} className="app-input min-h-[160px] resize-y py-3 md:col-span-2" placeholder="粘贴完整 Cookie / Session 内容" />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => void saveSession()} disabled={sessionSubmitting} className="app-button app-button-primary h-10 px-4 text-xs">
                {sessionSubmitting ? "保存中" : "保存登录态"}
              </button>
              <button type="button" onClick={() => setSessionEditingId(null)} className="app-button app-button-secondary h-10 px-4 text-xs">
                收起录入面板
              </button>
            </div>
          </div>
        ) : null}
        {qrSession ? (
          <div className="mt-4 rounded-[24px] border border-white/10 bg-white/5 p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-app-text-strong">扫码登录进行中</p>
                <p className="mt-2 text-sm leading-6 text-app-text-soft">{qrSession.message || "等待扫码"}</p>
                <p className="mt-2 text-xs text-app-text-soft">二维码有效期至 {formatDateTime(qrSession.expiresAt)}</p>
                {qrSession.state === "SCANNED" ? <AppNotice tone="info" className="mt-3">已扫码，请在手机上确认登录。</AppNotice> : null}
                {qrSession.state === "EXPIRED" ? <AppNotice tone="error" className="mt-3">二维码已过期，请重新生成。</AppNotice> : null}
                {qrSession.state === "FAILED" ? <AppNotice tone="error" className="mt-3">{qrSession.message || "扫码登录失败，请重新生成二维码。"}</AppNotice> : null}
              </div>
              <div className="overflow-hidden rounded-[20px] border border-white/10 bg-white p-3">
                <Image src={qrSession.qrImageDataUrl} alt="微博扫码二维码" width={180} height={180} className="h-[180px] w-[180px]" unoptimized />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => qrAccountId && void startQrLogin(qrAccountId)} disabled={qrLoading} className="app-button app-button-secondary">
                {qrLoading ? "生成中" : "重新生成二维码"}
              </button>
              <button type="button" onClick={() => { setQrAccountId(null); setQrSession(null); }} className="app-button app-button-secondary">
                收起扫码面板
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          {editingId ? (
            <button type="button" onClick={cancelEdit} className="app-button app-button-secondary">
              取消编辑
            </button>
          ) : null}
          {!editingId ? (
            <button type="button" onClick={() => void submitForm(true)} disabled={submitting || qrLoading} className="app-button app-button-secondary">
              {submitting ? "处理中" : "新增并扫码登录"}
            </button>
          ) : null}
          <button type="button" onClick={() => void submitForm()} disabled={submitting || qrLoading} className="app-button app-button-primary">
            {editingId ? "保存账号" : "新增账号"}
          </button>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader
          title="账号列表"
          description="读写基础能力已经接入，下面可以直接做账号编辑、删除和登录态检测。"
          action={
            <button type="button" onClick={() => void checkAllSessions()} disabled={bulkChecking || checkingId !== null} className="app-button app-button-secondary">
              {bulkChecking ? "批量检测中" : "一键检测全部账号"}
            </button>
          }
        />

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
                      <p className="mt-1 font-mono text-xs text-app-text-soft">{account.uid || account.proxyNode?.name || account.proxyNodeId || "-"}</p>
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
                        <button type="button" onClick={() => openSessionEditor(account)} className="app-button app-button-secondary h-10 px-4 text-xs">
                          录入 Session
                        </button>
                        <button type="button" onClick={() => void deleteAccount(account.id)} disabled={deletingId === account.id} className="app-button app-button-secondary h-10 px-4 text-xs text-app-danger hover:border-app-danger/30 hover:text-app-danger">
                          {deletingId === account.id ? "删除中" : "删除账号"}
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
