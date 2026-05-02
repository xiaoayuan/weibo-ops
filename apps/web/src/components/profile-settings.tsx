"use client";

import { useState } from "react";

import { AppNotice } from "@/components/app-notice";
import type { ProfileSettingsData } from "@/lib/app-data";
import { readJsonResponse } from "@/lib/http";

type ProxyProtocol = "HTTP" | "HTTPS" | "SOCKS5";

type ProfileResponse = {
  success: boolean;
  message?: string;
  data: ProfileSettingsData;
};

function getProxyStatusText(settings: {
  proxyEnabled: boolean;
  proxyProtocol: ProxyProtocol;
  proxyHost: string;
  proxyPort: number;
}) {
  const hasCoreConfig = settings.proxyHost.trim() !== "" && settings.proxyPort > 0;

  if (!hasCoreConfig) {
    return "未配置代理";
  }

  if (!settings.proxyEnabled) {
    return "已配置代理，当前未启用";
  }

  return `已启用 ${settings.proxyProtocol} 代理`;
}

export function ProfileSettings({ initial }: { initial: ProfileSettingsData }) {
  const [username, setUsername] = useState(initial.username);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [proxyEnabled, setProxyEnabled] = useState(initial.proxyEnabled);
  const [proxyProtocol, setProxyProtocol] = useState<ProxyProtocol>(initial.proxyProtocol);
  const [proxyHost, setProxyHost] = useState(initial.proxyHost);
  const [proxyPort, setProxyPort] = useState(initial.proxyPort > 0 ? String(initial.proxyPort) : "");
  const [proxyUsername, setProxyUsername] = useState(initial.proxyUsername);
  const [proxyPassword, setProxyPassword] = useState("");
  const [proxyPasswordConfigured, setProxyPasswordConfigured] = useState(initial.proxyPasswordConfigured);
  const [taskConcurrency, setTaskConcurrency] = useState(String(initial.taskConcurrency ?? 1));
  const [autoGenerateEnabled, setAutoGenerateEnabled] = useState(initial.autoGenerateEnabled ?? false);
  const [autoGenerateWindowStart, setAutoGenerateWindowStart] = useState(initial.autoGenerateWindowStart ?? "00:30");
  const [autoGenerateWindowEnd, setAutoGenerateWindowEnd] = useState(initial.autoGenerateWindowEnd ?? "03:00");
  const [autoExecuteEnabled, setAutoExecuteEnabled] = useState(initial.autoExecuteEnabled ?? false);
  const [autoExecuteStartTime, setAutoExecuteStartTime] = useState(initial.autoExecuteStartTime ?? "01:00");
  const [autoExecuteEndTime, setAutoExecuteEndTime] = useState(initial.autoExecuteEndTime ?? "18:00");
  const [submitting, setSubmitting] = useState(false);
  const [testingProxy, setTestingProxy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const proxyStatusText = getProxyStatusText({
    proxyEnabled,
    proxyProtocol,
    proxyHost,
    proxyPort: proxyPort.trim() === "" ? 0 : Number(proxyPort),
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedUsername = username.trim();
    const trimmedProxyHost = proxyHost.trim();
    const trimmedProxyUsername = proxyUsername.trim();
    const numericProxyPort = proxyPort.trim() === "" ? undefined : Number(proxyPort);
    const hasUsernameChange = trimmedUsername !== initial.username;
    const hasPasswordChange = newPassword !== "";
    const hasSettingsChange =
      proxyEnabled !== initial.proxyEnabled ||
      proxyProtocol !== initial.proxyProtocol ||
      trimmedProxyHost !== initial.proxyHost ||
      (numericProxyPort || 0) !== initial.proxyPort ||
      trimmedProxyUsername !== initial.proxyUsername ||
      proxyPassword !== "" ||
      Number(taskConcurrency) !== (initial.taskConcurrency ?? 1) ||
      autoGenerateEnabled !== (initial.autoGenerateEnabled ?? false) ||
      autoGenerateWindowStart !== (initial.autoGenerateWindowStart ?? "00:30") ||
      autoGenerateWindowEnd !== (initial.autoGenerateWindowEnd ?? "03:00") ||
      autoExecuteEnabled !== (initial.autoExecuteEnabled ?? false) ||
      autoExecuteStartTime !== (initial.autoExecuteStartTime ?? "01:00") ||
      autoExecuteEndTime !== (initial.autoExecuteEndTime ?? "18:00");

    if (!hasUsernameChange && !hasPasswordChange && !hasSettingsChange) {
      setError("请至少修改一个设置项");
      setMessage(null);
      return;
    }

    if (hasPasswordChange && newPassword !== confirmPassword) {
      setError("两次输入的密码不一致");
      setMessage(null);
      return;
    }

    if (autoGenerateWindowStart >= autoGenerateWindowEnd) {
      setError("每日自动生成窗口结束时间必须晚于开始时间");
      setMessage(null);
      return;
    }

    if (autoExecuteStartTime >= autoExecuteEndTime) {
      setError("每日自动执行结束时间必须晚于开始时间");
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
          autoGenerateEnabled,
          autoGenerateWindowStart,
          autoGenerateWindowEnd,
          autoExecuteEnabled,
          autoExecuteStartTime,
          autoExecuteEndTime,
        }),
      });
      const result = await readJsonResponse<ProfileResponse>(response);

      if (!response.ok || !result.success) {
        throw new Error(result.message || "保存设置失败");
      }

      setUsername(result.data.username);
      setProxyPassword("");
      setProxyPasswordConfigured(result.data.proxyPasswordConfigured);
      setNewPassword("");
      setConfirmPassword("");
      setMessage(result.message || "设置已更新");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存设置失败");
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
      const result = await readJsonResponse<{ success: boolean; message?: string }>(response);

      if (!response.ok || !result.success) {
        throw new Error(result.message || "代理测试失败");
      }

      setMessage(result.message || "代理连通性测试通过");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "代理测试失败");
      setMessage(null);
    } finally {
      setTestingProxy(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-app-text">用户名</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} className="app-input h-12" placeholder="请输入用户名" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-app-text">新密码</span>
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="app-input h-12" placeholder="留空则不修改" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-app-text">确认新密码</span>
          <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="app-input h-12" placeholder="再次输入新密码" />
        </label>
      </div>

      <div className="rounded-[18px] border border-app-line bg-app-panel-muted p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-app-text-strong">代理与自动化偏好</p>
            <p className="mt-1 text-sm text-app-text-soft">当前状态：{proxyStatusText}</p>
          </div>
          <button type="button" onClick={() => void handleProxyTest()} disabled={testingProxy} className="app-button app-button-secondary h-10 px-4 text-xs">
            {testingProxy ? "测试中" : "测试代理"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-[16px] border border-app-line bg-app-panel px-4 py-3 text-sm text-app-text-soft md:col-span-2">
            <input type="checkbox" checked={proxyEnabled} onChange={(event) => setProxyEnabled(event.target.checked)} />
            启用代理
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-app-text">代理协议</span>
            <select value={proxyProtocol} onChange={(event) => setProxyProtocol(event.target.value as ProxyProtocol)} className="app-input h-12">
              <option value="HTTP">HTTP</option>
              <option value="HTTPS">HTTPS</option>
              <option value="SOCKS5">SOCKS5</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-app-text">代理端口</span>
            <input type="number" value={proxyPort} onChange={(event) => setProxyPort(event.target.value)} className="app-input h-12" placeholder="1080" />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-app-text">代理主机</span>
            <input value={proxyHost} onChange={(event) => setProxyHost(event.target.value)} className="app-input h-12" placeholder="127.0.0.1" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-app-text">代理用户名</span>
            <input value={proxyUsername} onChange={(event) => setProxyUsername(event.target.value)} className="app-input h-12" placeholder="可留空" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-app-text">代理密码</span>
            <input type="password" value={proxyPassword} onChange={(event) => setProxyPassword(event.target.value)} className="app-input h-12" placeholder={proxyPasswordConfigured ? "已配置，留空则不修改" : "可留空"} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-app-text">用户并发数</span>
            <input type="number" min={1} max={5} value={taskConcurrency} onChange={(event) => setTaskConcurrency(event.target.value)} className="app-input h-12" />
          </label>
          <label className="flex items-center gap-3 rounded-[16px] border border-app-line bg-app-panel px-4 py-3 text-sm text-app-text-soft">
            <input type="checkbox" checked={autoGenerateEnabled} onChange={(event) => setAutoGenerateEnabled(event.target.checked)} />
            启用每日自动生成
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-app-text">生成窗口开始</span>
            <input type="time" value={autoGenerateWindowStart} onChange={(event) => setAutoGenerateWindowStart(event.target.value)} className="app-input h-12" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-app-text">生成窗口结束</span>
            <input type="time" value={autoGenerateWindowEnd} onChange={(event) => setAutoGenerateWindowEnd(event.target.value)} className="app-input h-12" />
          </label>
          <label className="flex items-center gap-3 rounded-[16px] border border-app-line bg-app-panel px-4 py-3 text-sm text-app-text-soft">
            <input type="checkbox" checked={autoExecuteEnabled} onChange={(event) => setAutoExecuteEnabled(event.target.checked)} />
            启用每日自动执行
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-app-text">执行开始时间</span>
            <input type="time" value={autoExecuteStartTime} onChange={(event) => setAutoExecuteStartTime(event.target.value)} className="app-input h-12" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-app-text">执行结束时间</span>
            <input type="time" value={autoExecuteEndTime} onChange={(event) => setAutoExecuteEndTime(event.target.value)} className="app-input h-12" />
          </label>
        </div>
      </div>

      {error ? <AppNotice tone="error">{error}</AppNotice> : null}
      {message ? <AppNotice tone="success">{message}</AppNotice> : null}

      <div>
        <button type="submit" disabled={submitting} className="app-button app-button-primary h-11 px-6">
          {submitting ? "保存中…" : "保存设置"}
        </button>
      </div>
    </form>
  );
}
