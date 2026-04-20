"use client";

import type { WeiboAccount } from "@/generated/prisma/client";
import { canManageBusinessData } from "@/lib/permission-rules";
import type { AppRole } from "@/lib/permission-rules";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";

type AccountStatus = "ACTIVE" | "DISABLED" | "RISKY" | "EXPIRED";
type AccountLoginStatus = "UNKNOWN" | "ONLINE" | "EXPIRED" | "FAILED";

type FormState = {
  nickname: string;
  remark: string;
  groupName: string;
  status: AccountStatus;
  uid: string;
  username: string;
  cookie: string;
};

type SessionFormState = {
  uid: string;
  username: string;
  cookie: string;
};

type QrLoginState = "WAITING" | "SCANNED" | "CONFIRMED" | "EXPIRED" | "FAILED";

type QrLoginSession = {
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
  uid: "",
  username: "",
  cookie: "",
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
  const [qrLoading, setQrLoading] = useState(false);
  const [qrSession, setQrSession] = useState<QrLoginSession | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [batchChecking, setBatchChecking] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canManage = canManageBusinessData(currentUserRole);

  useEffect(() => {
    if (!sessionEditingId || !qrSession || ["CONFIRMED", "EXPIRED", "FAILED"].includes(qrSession.state)) {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/accounts/${sessionEditingId}/session/qr/status?sessionId=${encodeURIComponent(qrSession.sessionId)}`, {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "查询扫码状态失败");
        }

        setQrSession((current) =>
          current
            ? {
                ...current,
                state: result.data.state,
                message: result.data.message,
              }
            : current,
        );

        if (result.data.state === "CONFIRMED" && result.data.account) {
          setAccounts((current) =>
            current.map((item) =>
              item.id === sessionEditingId
                ? {
                    ...item,
                    nickname: result.data.account.nickname,
                    uid: result.data.account.uid,
                    username: result.data.account.username,
                    loginStatus: result.data.account.loginStatus,
                    cookieUpdatedAt: result.data.account.cookieUpdatedAt,
                    lastCheckAt: result.data.account.lastCheckAt,
                    loginErrorMessage: result.data.account.loginErrorMessage,
                    consecutiveFailures: result.data.account.consecutiveFailures,
                  }
                : item,
            ),
          );

          setNotice(result.message || "扫码登录完成并已保存 Cookie");
          setSessionEditingId(null);
          setSessionForm(initialSessionForm);
          setQrSession(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "查询扫码状态失败");
      }
    }, 2000);

    return () => {
      window.clearInterval(timer);
    };
  }, [sessionEditingId, qrSession]);

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

    await submitAccount(false);
  }

  async function handleSubmitAndQr(event?: { preventDefault?: () => void }) {
    event?.preventDefault?.();

    await submitAccount(true);
  }

  async function submitAccount(startQrAfterCreate: boolean) {
    const isCreating = !editingId;
    const autoNickname = "未命名账号";
    const createNickname =
      form.nickname.trim() || form.username.trim() || form.uid.trim() || autoNickname;

    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const payload = {
        nickname: isCreating ? createNickname : form.nickname,
        remark: form.remark,
        groupName: form.groupName,
        status: form.status,
      };

      const response = await fetch(editingId ? `/api/accounts/${editingId}` : "/api/accounts", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "新增账号失败");
      }

      let mergedAccount = result.data as WeiboAccount;

      if (!editingId && form.cookie.trim()) {
        const sessionResponse = await fetch(`/api/accounts/${result.data.id}/session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uid: form.uid,
            username: form.username,
            cookie: form.cookie,
          }),
        });
        const sessionResult = await sessionResponse.json();

        if (!sessionResponse.ok) {
          setError(`账号已创建，但 Cookie 保存失败：${sessionResult.message || "请稍后在列表中录入"}`);
        } else {
          mergedAccount = {
            ...result.data,
            uid: sessionResult.data.uid,
            username: sessionResult.data.username,
            loginStatus: sessionResult.data.loginStatus,
            cookieUpdatedAt: sessionResult.data.cookieUpdatedAt,
          };
          setNotice("账号已创建并完成 Cookie 录入");
        }
      }

      setForm(initialForm);
      setEditingId(null);

      setAccounts((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? mergedAccount : item))
          : [mergedAccount, ...current],
      );

      if (isCreating && startQrAfterCreate && !form.cookie.trim()) {
        setSessionEditingId(mergedAccount.id);
        setSessionForm({
          uid: mergedAccount.uid || "",
          username: mergedAccount.username || "",
          cookie: "",
        });
        setQrSession(null);

        await startQrLoginForAccount(mergedAccount.id);
      }
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
      uid: account.uid || "",
      username: account.username || "",
      cookie: "",
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
    setQrSession(null);
    setError(null);
    setNotice(null);
  }

  function handleCancelSessionEdit() {
    setSessionEditingId(null);
    setSessionForm(initialSessionForm);
    setQrSession(null);
    setError(null);
  }

  async function handleStartQrLogin() {
    if (!sessionEditingId) {
      return;
    }

    await startQrLoginForAccount(sessionEditingId);
  }

  async function startQrLoginForAccount(accountId: string) {
    try {
      setQrLoading(true);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/accounts/${accountId}/session/qr/start`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "生成扫码二维码失败");
      }

      setQrSession({
        sessionId: result.data.sessionId,
        state: result.data.state,
        qrImageDataUrl: result.data.qrImageDataUrl,
        expiresAt: result.data.expiresAt,
        message: "等待扫码",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成扫码二维码失败");
    } finally {
      setQrLoading(false);
    }
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
      setNotice("Cookie 已保存");
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

  async function handleBatchCheckSession() {
    const candidateIds = new Set(selectedAccountIds);
    const candidates =
      selectedAccountIds.length > 0
        ? filteredAccounts.filter((account) => candidateIds.has(account.id))
        : filteredAccounts;

    if (candidates.length === 0) {
      setError("当前筛选下没有可检测账号");
      return;
    }

    if (!window.confirm(`确认检测当前筛选的 ${candidates.length} 个账号登录态吗？`)) {
      return;
    }

    try {
      setBatchChecking(true);
      setError(null);

      let failed = 0;

      for (const account of candidates) {
        try {
          setCheckingId(account.id);

          const response = await fetch(`/api/accounts/${account.id}/check-session`, {
            method: "POST",
          });
          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.message || "检测登录态失败");
          }

          if (!result.success) {
            failed += 1;
          }

          setAccounts((current) =>
            current.map((item) =>
              item.id === account.id
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
        } catch {
          failed += 1;
        } finally {
          setCheckingId(null);
        }
      }

      if (failed > 0) {
        setError(`一键检测完成，失败 ${failed} 个账号，请查看列表错误信息`);
      }
    } finally {
      setBatchChecking(false);
      setCheckingId(null);
    }
  }

  function toggleAccountSelection(id: string) {
    setSelectedAccountIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectAllFiltered() {
    setSelectedAccountIds(filteredAccounts.map((account) => account.id));
  }

  function clearSelection() {
    setSelectedAccountIds([]);
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

  async function handleBatchDelete() {
    const candidateIds = new Set(selectedAccountIds);
    const candidates =
      selectedAccountIds.length > 0
        ? filteredAccounts.filter((account) => candidateIds.has(account.id))
        : filteredAccounts;

    if (candidates.length === 0) {
      setError("当前筛选下没有可删除账号");
      return;
    }

    if (!window.confirm(`确认删除 ${candidates.length} 个账号吗？该操作不可恢复。`)) {
      return;
    }

    try {
      setBatchDeleting(true);
      setError(null);

      let failed = 0;

      for (const account of candidates) {
        try {
          const response = await fetch(`/api/accounts/${account.id}`, {
            method: "DELETE",
          });
          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.message || "删除账号失败");
          }

          setAccounts((current) => current.filter((item) => item.id !== account.id));
          setSelectedAccountIds((current) => current.filter((id) => id !== account.id));
        } catch {
          failed += 1;
        }
      }

      if (failed > 0) {
        setError(`批量删除完成，失败 ${failed} 个账号，请重试或检查依赖数据`);
      }
    } finally {
      setBatchDeleting(false);
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
              placeholder="可留空，扫码后自动回填"
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

          {!editingId ? (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">微博 UID（可选）</label>
                <input
                  value={form.uid}
                  onChange={(event) => setForm((current) => ({ ...current, uid: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                  placeholder="可留空，后续检测时自动补全"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">微博用户名（可选）</label>
                <input
                  value={form.username}
                  onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                  placeholder="可留空，后续检测时自动补全"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">创建时直接录入 Cookie（可选）</label>
                <textarea
                  value={form.cookie}
                  onChange={(event) => setForm((current) => ({ ...current, cookie: event.target.value }))}
                  className="min-h-28 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                  placeholder="粘贴微博 Cookie，可一步完成账号创建+登录态录入"
                />
              </div>
            </>
          ) : null}

          <div className="md:col-span-2 flex items-center justify-between gap-3">
            <div>
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "提交中..." : editingId ? "保存修改" : "新增账号"}
              </button>
              {!editingId ? (
                <button
                  type="button"
                  onClick={handleSubmitAndQr}
                  disabled={submitting}
                  className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "处理中..." : "新增并扫码登录"}
                </button>
              ) : null}
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
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">支持扫码自动登录微博并提取 Cookie，也可继续手动粘贴。</p>
              <button
                type="button"
                onClick={handleStartQrLogin}
                disabled={qrLoading}
                className="rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {qrLoading ? "生成中..." : "生成扫码二维码"}
              </button>
            </div>

            {qrSession ? (
              <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr] md:items-start">
                <Image
                  src={qrSession.qrImageDataUrl}
                  alt="微博扫码二维码"
                  width={180}
                  height={180}
                  unoptimized
                  className="h-[180px] w-[180px] rounded-lg border border-slate-200 bg-white p-2"
                />
                <div className="space-y-2 text-sm text-slate-600">
                  <p>
                    当前状态：
                    <span className="ml-1 font-medium text-slate-900">
                      {qrSession.state === "WAITING"
                        ? "等待扫码"
                        : qrSession.state === "SCANNED"
                          ? "已扫码，等待确认"
                          : qrSession.state === "CONFIRMED"
                            ? "已确认"
                            : qrSession.state === "EXPIRED"
                              ? "二维码已过期"
                              : "失败"}
                    </span>
                  </p>
                  <p>过期时间：{new Date(qrSession.expiresAt).toLocaleString("zh-CN")}</p>
                  <p>{qrSession.message || "请用微博 App 扫码并确认登录"}</p>
                </div>
              </div>
            ) : null}
          </div>
          <form className="mt-4 grid gap-4" onSubmit={handleSessionSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">微博 UID（可选）</label>
                <input
                  value={sessionForm.uid}
                  onChange={(event) => setSessionForm((current) => ({ ...current, uid: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                  placeholder="可留空，沿用当前账号信息"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">微博用户名（可选）</label>
                <input
                  value={sessionForm.username}
                  onChange={(event) => setSessionForm((current) => ({ ...current, username: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                  placeholder="可留空，沿用当前账号信息"
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
              {canManage ? (
                <button
                  type="button"
                  onClick={handleBatchCheckSession}
                  disabled={batchChecking}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {batchChecking ? "检测中..." : selectedAccountIds.length > 0 ? `检测选中账号 (${selectedAccountIds.length})` : "一键检测当前筛选"}
                </button>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  全选当前筛选
                </button>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  清空选择
                </button>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  onClick={handleBatchDelete}
                  disabled={batchDeleting}
                  className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {batchDeleting ? "删除中..." : selectedAccountIds.length > 0 ? `删除选中账号 (${selectedAccountIds.length})` : "删除当前筛选"}
                </button>
              ) : null}
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
                  {canManage ? <th className="px-6 py-3 font-medium">选择</th> : null}
                  <th className="px-6 py-3 font-medium">账号昵称</th>
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
                    {canManage ? (
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedAccountIds.includes(account.id)}
                          onChange={() => toggleAccountSelection(account.id)}
                        />
                      </td>
                    ) : null}
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{account.nickname}</div>
                      <div className="mt-1 text-xs text-slate-500">{statusText[account.status]} / 风险 {account.riskLevel}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        微博：{account.username || "-"} / UID：{account.uid || "-"}
                      </div>
                    </td>
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
