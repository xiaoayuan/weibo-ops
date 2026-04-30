"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();

        try {
          setSubmitting(true);
          setError(null);
          setNotice(null);

          const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ username, password, inviteCode }),
          });
          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.message || "注册失败");
          }

          setNotice("注册成功，正在跳转到登录页");
          window.setTimeout(() => {
            router.replace("/login");
            router.refresh();
          }, 600);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "注册失败");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium text-app-text-soft">用户名</label>
        <input
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="请输入用户名"
          className="app-input"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-app-text-soft">密码</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="密码至少 6 位"
          className="app-input"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-app-text-soft">注册码</label>
        <input
          type="text"
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
          placeholder="请输入管理员提供的注册码"
          className="app-input uppercase"
          required
        />
      </div>

      {error ? <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
      {notice ? <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{notice}</p> : null}

      <button type="submit" disabled={submitting} className="app-button app-button-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60">
        {submitting ? "注册中..." : "创建账号"}
      </button>

      <p className="text-center text-sm text-app-text-muted">
        已有账号？
        <Link href="/login" className="ml-1 text-app-accent transition hover:text-app-text-strong">
          去登录
        </Link>
      </p>
    </form>
  );
}
