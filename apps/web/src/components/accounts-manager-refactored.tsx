"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { AppNotice } from "@/components/app-notice";
import { AccountStats } from "./accounts/account-stats";
import { AccountForm } from "./accounts/account-form";
import { AccountsList } from "./accounts/accounts-list";
import { SessionEditor } from "./accounts/session-editor";
import { QrLoginModal } from "./accounts/qr-login-modal";
import type { WeiboAccount } from "@/lib/app-data";
import type {
  FormState,
  SessionFormState,
  QrSession,
  initialForm as initialFormType,
} from "./accounts/types";
import { initialForm } from "./accounts/types";

type AccountsManagerRefactoredProps = {
  initialAccounts: WeiboAccount[];
};

export function AccountsManagerRefactored({
  initialAccounts,
}: AccountsManagerRefactoredProps) {
  // 状态管理
  const [accounts, setAccounts] = useState(initialAccounts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sessionEditingId, setSessionEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [sessionForm, setSessionForm] = useState<SessionFormState>({
    uid: "",
    username: "",
    cookie: "",
  });
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

  // 二维码轮询
  useEffect(() => {
    if (!qrSession || qrSession.state !== "WAITING") return;

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/accounts/${qrAccountId}/qr-login/status?sessionId=${qrSession.sessionId}`
        );
        const result = await response.json();

        if (result.success && result.data) {
          setQrSession({
            ...qrSession,
            state: result.data.state,
            message: result.data.message,
          });

          if (result.data.state === "CONFIRMED") {
            setNotice("登录成功");
            // 刷新账号列表
            const accountsResponse = await fetch("/api/accounts");
            const accountsResult = await accountsResponse.json();
            if (accountsResult.success) {
              setAccounts(accountsResult.data);
            }
          }
        }
      } catch (err) {
        console.error("轮询二维码状态失败:", err);
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [qrSession, qrAccountId]);

  // 账号操作
  const handleEdit = (account: WeiboAccount) => {
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
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(initialForm);
  };

  const handleSubmit = async () => {
    if (!form.nickname.trim()) {
      setError("请输入账号昵称");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const url = editingId ? `/api/accounts/${editingId}` : "/api/accounts";
      const method = editingId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "操作失败");
      }

      if (editingId) {
        setAccounts(
          accounts.map((acc) => (acc.id === editingId ? result.data : acc))
        );
        setNotice("账号已更新");
        handleCancelEdit();
      } else {
        setAccounts([result.data, ...accounts]);
        setNotice(result.message || "账号已创建");
        setForm(initialForm);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  // Session 操作
  const handleEditSession = (account: WeiboAccount) => {
    setSessionEditingId(account.id);
    setSessionForm({
      uid: account.uid || "",
      username: account.username || "",
      cookie: "",
    });
  };

  const handleCancelSessionEdit = () => {
    setSessionEditingId(null);
    setSessionForm({ uid: "", username: "", cookie: "" });
  };

  const handleSubmitSession = async () => {
    if (!sessionForm.cookie.trim()) {
      setError("请输入 Cookie");
      return;
    }

    setSessionSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/accounts/${sessionEditingId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionForm),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "保存失败");
      }

      setAccounts(
        accounts.map((acc) =>
          acc.id === sessionEditingId
            ? {
                ...acc,
                uid: result.data.uid,
                username: result.data.username,
                loginStatus: result.data.loginStatus,
                cookieUpdatedAt: result.data.cookieUpdatedAt,
              }
            : acc
        )
      );

      setNotice("登录信息已更新");
      handleCancelSessionEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSessionSubmitting(false);
    }
  };

  // 检查登录状态
  const handleCheckSession = async (id: string) => {
    setCheckingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/accounts/${id}/check-session`, {
        method: "POST",
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "检查失败");
      }

      setAccounts(
        accounts.map((acc) =>
          acc.id === id
            ? {
                ...acc,
                loginStatus: result.data.loginStatus,
                lastCheckAt: result.data.lastCheckAt,
                loginErrorMessage: result.data.loginErrorMessage,
                consecutiveFailures: result.data.consecutiveFailures,
              }
            : acc
        )
      );

      setNotice("登录状态已更新");
    } catch (err) {
      setError(err instanceof Error ? err.message : "检查失败");
    } finally {
      setCheckingId(null);
    }
  };

  const handleBulkCheck = async () => {
    setBulkChecking(true);
    setError(null);

    try {
      const response = await fetch("/api/accounts/bulk-check-session", {
        method: "POST",
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "批量检查失败");
      }

      // 刷新账号列表
      const accountsResponse = await fetch("/api/accounts");
      const accountsResult = await accountsResponse.json();

      if (accountsResult.success) {
        setAccounts(accountsResult.data);
      }

      setNotice("批量检查完成");
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量检查失败");
    } finally {
      setBulkChecking(false);
    }
  };

  // 二维码登录
  const handleStartQrLogin = async (id: string) => {
    setQrAccountId(id);
    setQrLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/accounts/${id}/qr-login/start`, {
        method: "POST",
      });

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.message || "启动二维码登录失败");
      }

      setQrSession(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "启动二维码登录失败");
      setQrAccountId(null);
    } finally {
      setQrLoading(false);
    }
  };

  const handleCloseQrLogin = () => {
    setQrAccountId(null);
    setQrSession(null);
  };

  // 删除账号
  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个账号吗？")) return;

    setDeletingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "删除失败");
      }

      setAccounts(accounts.filter((acc) => acc.id !== id));
      setNotice("账号已删除");
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  const qrAccount = qrAccountId
    ? accounts.find((acc) => acc.id === qrAccountId)
    : null;

  const sessionEditingAccount = sessionEditingId
    ? accounts.find((acc) => acc.id === sessionEditingId)
    : null;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="账号管理"
        description="管理微博账号、登录状态和代理配置。"
      />

      {error && <AppNotice tone="error">{error}</AppNotice>}
      {notice && <AppNotice tone="success">{notice}</AppNotice>}

      <AccountStats accounts={accounts} />

      {!editingId && !sessionEditingId && (
        <AccountForm
          form={form}
          editingId={editingId}
          submitting={submitting}
          onFormChange={setForm}
          onSubmit={handleSubmit}
          onCancel={handleCancelEdit}
        />
      )}

      {editingId && (
        <AccountForm
          form={form}
          editingId={editingId}
          submitting={submitting}
          onFormChange={setForm}
          onSubmit={handleSubmit}
          onCancel={handleCancelEdit}
        />
      )}

      {sessionEditingId && sessionEditingAccount && (
        <SessionEditor
          accountNickname={sessionEditingAccount.nickname}
          form={sessionForm}
          submitting={sessionSubmitting}
          onFormChange={setSessionForm}
          onSubmit={handleSubmitSession}
          onCancel={handleCancelSessionEdit}
        />
      )}

      <AccountsList
        accounts={accounts}
        checkingId={checkingId}
        bulkChecking={bulkChecking}
        deletingId={deletingId}
        onEdit={handleEdit}
        onEditSession={handleEditSession}
        onCheckSession={handleCheckSession}
        onBulkCheck={handleBulkCheck}
        onStartQrLogin={handleStartQrLogin}
        onDelete={handleDelete}
      />

      {qrAccountId && qrAccount && (
        <QrLoginModal
          accountNickname={qrAccount.nickname}
          session={qrSession}
          loading={qrLoading}
          onClose={handleCloseQrLogin}
        />
      )}
    </div>
  );
}
