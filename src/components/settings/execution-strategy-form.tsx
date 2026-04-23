"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type UrgencyConfig = {
  waveRatios: [number, number, number];
  waveWindowsSec: [number, number, number];
  cooldownSecRange: [number, number];
  retryDelaySecRange: [number, number];
  targetSlaSec: number;
  limitSlaSec: number;
};

type ExecutionStrategy = {
  actionJob: {
    maxRetry: number;
    urgency: {
      S: UrgencyConfig;
      A: UrgencyConfig;
      B: UrgencyConfig;
    };
  };
  circuitBreaker: {
    accountFailureThreshold: number;
    accountPauseMinutes: number;
    proxyWindowMinutes: number;
    proxyMinSamples: number;
    proxyFailureRatio: number;
    proxyPauseMinutes: number;
  };
};

function toCsv(values: number[]) {
  return values.join(",");
}

function parseCsv(text: string, count: number) {
  const parsed = text
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((value) => Number.isFinite(value));

  if (parsed.length !== count) {
    throw new Error(`请填写 ${count} 个数字，使用逗号分隔`);
  }

  return parsed;
}

export function ExecutionStrategyForm({ initialConfig }: { initialConfig: ExecutionStrategy }) {
  const router = useRouter();
  const [maxRetry, setMaxRetry] = useState(String(initialConfig.actionJob.maxRetry));

  const [sRatios, setSRatios] = useState(toCsv(initialConfig.actionJob.urgency.S.waveRatios));
  const [aRatios, setARatios] = useState(toCsv(initialConfig.actionJob.urgency.A.waveRatios));
  const [bRatios, setBRatios] = useState(toCsv(initialConfig.actionJob.urgency.B.waveRatios));

  const [sWindows, setSWindows] = useState(toCsv(initialConfig.actionJob.urgency.S.waveWindowsSec));
  const [aWindows, setAWindows] = useState(toCsv(initialConfig.actionJob.urgency.A.waveWindowsSec));
  const [bWindows, setBWindows] = useState(toCsv(initialConfig.actionJob.urgency.B.waveWindowsSec));

  const [sCooldown, setSCooldown] = useState(toCsv(initialConfig.actionJob.urgency.S.cooldownSecRange));
  const [aCooldown, setACooldown] = useState(toCsv(initialConfig.actionJob.urgency.A.cooldownSecRange));
  const [bCooldown, setBCooldown] = useState(toCsv(initialConfig.actionJob.urgency.B.cooldownSecRange));

  const [sRetryDelay, setSRetryDelay] = useState(toCsv(initialConfig.actionJob.urgency.S.retryDelaySecRange));
  const [aRetryDelay, setARetryDelay] = useState(toCsv(initialConfig.actionJob.urgency.A.retryDelaySecRange));
  const [bRetryDelay, setBRetryDelay] = useState(toCsv(initialConfig.actionJob.urgency.B.retryDelaySecRange));

  const [sSla, setSSla] = useState(toCsv([initialConfig.actionJob.urgency.S.targetSlaSec, initialConfig.actionJob.urgency.S.limitSlaSec]));
  const [aSla, setASla] = useState(toCsv([initialConfig.actionJob.urgency.A.targetSlaSec, initialConfig.actionJob.urgency.A.limitSlaSec]));
  const [bSla, setBSla] = useState(toCsv([initialConfig.actionJob.urgency.B.targetSlaSec, initialConfig.actionJob.urgency.B.limitSlaSec]));

  const [accountFailureThreshold, setAccountFailureThreshold] = useState(String(initialConfig.circuitBreaker.accountFailureThreshold));
  const [accountPauseMinutes, setAccountPauseMinutes] = useState(String(initialConfig.circuitBreaker.accountPauseMinutes));
  const [proxyWindowMinutes, setProxyWindowMinutes] = useState(String(initialConfig.circuitBreaker.proxyWindowMinutes));
  const [proxyMinSamples, setProxyMinSamples] = useState(String(initialConfig.circuitBreaker.proxyMinSamples));
  const [proxyFailureRatio, setProxyFailureRatio] = useState(String(initialConfig.circuitBreaker.proxyFailureRatio));
  const [proxyPauseMinutes, setProxyPauseMinutes] = useState(String(initialConfig.circuitBreaker.proxyPauseMinutes));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function parseUrgencyConfig(ratiosText: string, windowsText: string, cooldownText: string, retryText: string, slaText: string): UrgencyConfig {
    const ratios = parseCsv(ratiosText, 3);
    const windows = parseCsv(windowsText, 3);
    const cooldown = parseCsv(cooldownText, 2);
    const retry = parseCsv(retryText, 2);
    const sla = parseCsv(slaText, 2);

    return {
      waveRatios: [ratios[0], ratios[1], ratios[2]],
      waveWindowsSec: [Math.round(windows[0]), Math.round(windows[1]), Math.round(windows[2])],
      cooldownSecRange: [Math.round(cooldown[0]), Math.round(cooldown[1])],
      retryDelaySecRange: [Math.round(retry[0]), Math.round(retry[1])],
      targetSlaSec: Math.round(sla[0]),
      limitSlaSec: Math.round(sla[1]),
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);
      setMessage(null);

      const payload: ExecutionStrategy = {
        actionJob: {
          maxRetry: Number(maxRetry),
          urgency: {
            S: parseUrgencyConfig(sRatios, sWindows, sCooldown, sRetryDelay, sSla),
            A: parseUrgencyConfig(aRatios, aWindows, aCooldown, aRetryDelay, aSla),
            B: parseUrgencyConfig(bRatios, bWindows, bCooldown, bRetryDelay, bSla),
          },
        },
        circuitBreaker: {
          accountFailureThreshold: Number(accountFailureThreshold),
          accountPauseMinutes: Number(accountPauseMinutes),
          proxyWindowMinutes: Number(proxyWindowMinutes),
          proxyMinSamples: Number(proxyMinSamples),
          proxyFailureRatio: Number(proxyFailureRatio),
          proxyPauseMinutes: Number(proxyPauseMinutes),
        },
      };

      const response = await fetch("/api/strategy-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "保存执行策略失败");
      }

      setMessage(result.message || "执行策略已保存");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存执行策略失败");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-medium">执行策略配置</h3>
        <p className="mt-1 text-sm text-slate-500">可在线调整波次比例、冷却与重试、熔断阈值，适配不同规模账号池。</p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">最大重试次数</span>
            <input value={maxRetry} onChange={(event) => setMaxRetry(event.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
        </div>

        {[
          { key: "S", title: "S级时效" as const, ratios: sRatios, setRatios: setSRatios, windows: sWindows, setWindows: setSWindows, cooldown: sCooldown, setCooldown: setSCooldown, retry: sRetryDelay, setRetry: setSRetryDelay, sla: sSla, setSla: setSSla },
          { key: "A", title: "A级时效" as const, ratios: aRatios, setRatios: setARatios, windows: aWindows, setWindows: setAWindows, cooldown: aCooldown, setCooldown: setACooldown, retry: aRetryDelay, setRetry: setARetryDelay, sla: aSla, setSla: setASla },
          { key: "B", title: "B级慢增" as const, ratios: bRatios, setRatios: setBRatios, windows: bWindows, setWindows: setBWindows, cooldown: bCooldown, setCooldown: setBCooldown, retry: bRetryDelay, setRetry: setBRetryDelay, sla: bSla, setSla: setBSla },
        ].map((item) => (
          <div key={item.key} className="rounded-lg border border-slate-200 p-4">
            <p className="font-medium text-slate-700">{item.title}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block"><span className="mb-1 block text-xs text-slate-500">波次比例(3个,逗号)</span><input value={item.ratios} onChange={(event) => item.setRatios(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
              <label className="block"><span className="mb-1 block text-xs text-slate-500">波次窗口秒(3个,逗号)</span><input value={item.windows} onChange={(event) => item.setWindows(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
              <label className="block"><span className="mb-1 block text-xs text-slate-500">账号冷却秒范围(2个)</span><input value={item.cooldown} onChange={(event) => item.setCooldown(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
              <label className="block"><span className="mb-1 block text-xs text-slate-500">重试延迟秒范围(2个)</span><input value={item.retry} onChange={(event) => item.setRetry(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
              <label className="block md:col-span-2"><span className="mb-1 block text-xs text-slate-500">SLA阈值秒(目标,上限)</span><input value={item.sla} onChange={(event) => item.setSla(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            </div>
          </div>
        ))}

        <div className="rounded-lg border border-slate-200 p-4">
          <p className="font-medium text-slate-700">熔断规则</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="block"><span className="mb-1 block text-xs text-slate-500">账号失败阈值</span><input value={accountFailureThreshold} onChange={(event) => setAccountFailureThreshold(event.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="block"><span className="mb-1 block text-xs text-slate-500">账号暂停分钟</span><input value={accountPauseMinutes} onChange={(event) => setAccountPauseMinutes(event.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="block"><span className="mb-1 block text-xs text-slate-500">代理窗口分钟</span><input value={proxyWindowMinutes} onChange={(event) => setProxyWindowMinutes(event.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="block"><span className="mb-1 block text-xs text-slate-500">代理最小样本</span><input value={proxyMinSamples} onChange={(event) => setProxyMinSamples(event.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="block"><span className="mb-1 block text-xs text-slate-500">代理失败率(0-1)</span><input value={proxyFailureRatio} onChange={(event) => setProxyFailureRatio(event.target.value)} type="number" step="0.01" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="block"><span className="mb-1 block text-xs text-slate-500">代理暂停分钟</span><input value={proxyPauseMinutes} onChange={(event) => setProxyPauseMinutes(event.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          </div>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

        <button type="submit" disabled={submitting} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? "保存中..." : "保存执行策略"}
        </button>
      </form>
    </section>
  );
}
