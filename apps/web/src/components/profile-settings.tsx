"use client";

import { useState } from "react";

import { AppNotice } from "@/components/app-notice";
import { readJsonResponse } from "@/lib/http";

export function ProfileSettings({ username }: { username: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirm) {
      setError("两次密码输入不一致");
      return;
    }

    if (password.length < 6) {
      setError("密码至少 6 个字符");
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await readJsonResponse<{ success: boolean; message?: string }>(response);

      if (!response.ok || !result.success) {
        throw new Error(result.message || "密码修改失败");
      }

      setPassword("");
      setConfirm("");
      setSuccess("密码已更新");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "密码修改失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
      <div className="rounded-[16px] border border-app-line bg-app-panel-muted px-5 py-4">
        <p className="text-sm text-app-text-soft">用户名</p>
        <p className="mt-1 text-base font-medium text-app-text-strong">{username}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-app-text">新密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="app-input mt-1 h-12 w-full max-w-sm"
          placeholder="至少 6 个字符"
          minLength={6}
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-app-text">确认密码</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="app-input mt-1 h-12 w-full max-w-sm"
          placeholder="再次输入新密码"
          minLength={6}
          autoComplete="new-password"
        />
      </div>

      {error ? <AppNotice tone="error">{error}</AppNotice> : null}
      {success ? <AppNotice tone="success">{success}</AppNotice> : null}

      <div>
        <button type="submit" disabled={submitting} className="app-button app-button-primary h-11 px-6">
          {submitting ? "保存中…" : "保存密码"}
        </button>
      </div>
    </form>
  );
}