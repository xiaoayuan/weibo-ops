"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ProxySettings = {
  proxyEnabled: boolean;
  proxyProtocol: "HTTP" | "HTTPS" | "SOCKS5";
  proxyHost: string;
  proxyPort: number;
  proxyUsername: string;
  proxyPasswordConfigured: boolean;
};

function getProxyStatusText(settings: ProxySettings) {
  const hasCoreConfig = settings.proxyHost.trim() !== "" && settings.proxyPort > 0;

  if (!hasCoreConfig) {
    return "未配置代理";
  }

  if (!settings.proxyEnabled) {
    return "已配置代理，当前未启用";
  }

  return `已启用 ${settings.proxyProtocol} 代理`;
}

export function ProfileSecurityForm({
  initialUsername,
  initialProxySettings,
  initialTaskConcurrency,
}: {
  initialUsername: string;
  initialProxySettings: ProxySettings;
  initialTaskConcurrency: number;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [proxyEnabled, setProxyEnabled] = useState(initialProxySettings.proxyEnabled);
  const [proxyProtocol, setProxyProtocol] = useState<"HTTP" | "HTTPS" | "SOCKS5">(initialProxySettings.proxyProtocol);
  const [proxyHost, setProxyHost] = useState(initialProxySettings.proxyHost);
  const [proxyPort, setProxyPort] = useState(initialProxySettings.proxyPort > 0 ? String(initialProxySettings.proxyPort) : "");
  const [proxyUsername, setProxyUsername] = useState(initialProxySettings.proxyUsername);
  const [proxyPassword, setProxyPassword] = useState("");
  const [proxyPasswordConfigured, setProxyPasswordConfigured] = useState(initialProxySettings.proxyPasswordConfigured);
  const [taskConcurrency, setTaskConcurrency] = useState(String(initialTaskConcurrency));
  const [submitting, setSubmitting] = useState(false);
  const [testingProxy, setTestingProxy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const proxyStatusText = getProxyStatusText({
    proxyEnabled,
    proxyProtocol,
    proxyHost,
    proxyPort: proxyPort.trim() === "" ? 0 : Number(proxyPort),
    proxyUsername,
    proxyPasswordConfigured,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedUsername = username.trim();
    const trimmedProxyHost = proxyHost.trim();
    const trimmedProxyUsername = proxyUsername.trim();
    const numericProxyPort = proxyPort.trim() === "" ? undefined : Number(proxyPort);
    const hasUsernameChange = trimmedUsername !== initialUsername;
    const hasPasswordChange = newPassword !== "";
    const hasProxyChange =
      proxyEnabled !== initialProxySettings.proxyEnabled ||
      proxyProtocol !== initialProxySettings.proxyProtocol ||
      trimmedProxyHost !== initialProxySettings.proxyHost ||
      (numericProxyPort || 0) !== initialProxySettings.proxyPort ||
      trimmedProxyUsername !== initialProxySettings.proxyUsername ||
      proxyPassword !== "" ||
      Number(taskConcurrency) !== initialTaskConcurrency;

    if (!hasUsernameChange && !hasPasswordChange && !hasProxyChange) {
      setError("请至少修改用户名、密码或代理配置");
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
          proxyEnabled,
          proxyProtocol,
          proxyHost: trimmedProxyHost,
          proxyPort: numericProxyPort,
          proxyUsername: trimmedProxyUsername,
          proxyPassword: proxyPassword !== "" ? proxyPassword : undefined,
          taskConcurrency: Number(taskConcurrency),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "更新失败");
      }

      setMessage(proxyEnabled ? "账号信息已更新，代理配置已保存并立即生效" : "账号信息已更新");
      setNewPassword("");
      setConfirmPassword("");
      setProxyPassword("");
      setUsername(result.data.username || trimmedUsername);
      setProxyPasswordConfigured(result.data.proxyPasswordConfigured);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失败");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProxyTest() {
    try {
      setTestingProxy(true);
      setError(null);
      setMessage(null);

      const response = await fetch("/api/auth/proxy-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proxyEnabled,
          proxyProtocol,
          proxyHost: proxyHost.trim(),
          proxyPort: proxyPort.trim() === "" ? undefined : Number(proxyPort),
          proxyUsername: proxyUsername.trim(),
          proxyPassword: proxyPassword !== "" ? proxyPassword : undefined,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "代理测试失败");
      }

      setMessage(result.message || "代理连通性测试通过");
    } catch (err) {
      setError(err instanceof Error ? err.message : "代理测试失败");
      setMessage(null);
    } finally {
      setTestingProxy(false);
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

        <div className="md:col-span-2 rounded-xl border border-slate-200 p-4">
          <div className="mb-4">
            <h4 className="text-base font-medium text-slate-900">代理配置</h4>
            <p className="mt-1 text-sm text-slate-500">保存后会立即作用于你归属账号的真实执行请求，支持 HTTP / HTTPS / SOCKS5。</p>
            <p className="mt-2 text-sm text-sky-700">当前状态：{proxyStatusText}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700">启用代理</span>
              <input type="checkbox" checked={proxyEnabled} onChange={(event) => setProxyEnabled(event.target.checked)} />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">代理协议</span>
              <select
                value={proxyProtocol}
                onChange={(event) => setProxyProtocol(event.target.value as "HTTP" | "HTTPS" | "SOCKS5")}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="HTTP">HTTP</option>
                <option value="HTTPS">HTTPS</option>
                <option value="SOCKS5">SOCKS5</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">代理端口</span>
              <input
                type="number"
                value={proxyPort}
                onChange={(event) => setProxyPort(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                placeholder="1080"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700">代理主机</span>
              <input
                type="text"
                value={proxyHost}
                onChange={(event) => setProxyHost(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                placeholder="127.0.0.1"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">代理用户名</span>
              <input
                type="text"
                value={proxyUsername}
                onChange={(event) => setProxyUsername(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                placeholder="留空则不认证"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">代理密码</span>
              <input
                type="password"
                value={proxyPassword}
                onChange={(event) => setProxyPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                placeholder={proxyPasswordConfigured ? "已配置，重新输入可覆盖" : "留空则不认证"}
              />
              <span className="mt-2 block text-xs text-slate-500">{proxyPasswordConfigured ? "当前已配置代理密码" : "当前未配置代理密码"}</span>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700">任务并发数</span>
              <select
                value={taskConcurrency}
                onChange={(event) => setTaskConcurrency(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="5">5</option>
              </select>
              <span className="mt-2 block text-xs text-slate-500">同一用户的所有任务会共享这个并发额度，默认 1 最稳。</span>
            </label>
          </div>
        </div>

        {error ? <p className="md:col-span-2 text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="md:col-span-2 text-sm text-emerald-600">{message}</p> : null}

        <div className="md:col-span-2 flex items-center gap-3">
          <button
            type="button"
            onClick={handleProxyTest}
            disabled={testingProxy || submitting}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {testingProxy ? "测试中..." : "测试代理"}
          </button>
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
