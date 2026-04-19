"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function ProfileSecurityForm({ initialUsername }: { initialUsername: string }) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedUsername = username.trim();
    const hasUsernameChange = trimmedUsername !== initialUsername;
    const hasPasswordChange = newPassword !== "";

    if (!hasUsernameChange && !hasPasswordChange) {
      setError("请至少修改用户名或密码");
      setMessage(null);
      return;
    }

    if (hasPasswordChange && newPassword !== confirmPassword) {
      setError("两次输入的密码不一致");
      setMessage(null);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setMessage(null);

      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: hasUsernameChange ? trimmedUsername : undefined,
          password: hasPasswordChange ? newPassword : undefined,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "更新失败");
      }

      setMessage("账号信息已更新");
      setNewPassword("");
      setConfirmPassword("");
      setUsername(result.data.username || trimmedUsername);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失败");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-medium">登录账号</h3>
        <p className="mt-1 text-sm text-slate-500">可修改当前登录用户的用户名和密码。</p>
      </div>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">用户名</span>
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="请输入用户名"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">新密码</span>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="留空则不修改"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm font-medium text-slate-700">确认新密码</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
            placeholder="再次输入新密码"
          />
        </label>

        {error ? <p className="md:col-span-2 text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="md:col-span-2 text-sm text-emerald-600">{message}</p> : null}

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "保存中..." : "保存登录信息"}
          </button>
        </div>
      </form>
    </section>
  );
}
