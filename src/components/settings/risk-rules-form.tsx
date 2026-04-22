"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type RiskRules = {
  keywords: {
    targetIssue: string[];
    contentIssue: string[];
    transientNetwork: string[];
    platformBusy: string[];
    accountRisk: string[];
  };
  score: {
    success: number;
    targetIssue: number;
    contentIssue: number;
    transientNetwork: number;
    platformBusy: number;
    accountRisk: number;
    unknownFailure: number;
  };
  threshold: {
    markRiskyAt: number;
    recoverActiveAt: number;
    maxRiskLevel: number;
  };
};

function toText(items: string[]) {
  return items.join("\n");
}

function fromText(text: string) {
  return text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function RiskRulesForm({ initialRules }: { initialRules: RiskRules }) {
  const router = useRouter();
  const [targetIssueText, setTargetIssueText] = useState(toText(initialRules.keywords.targetIssue));
  const [contentIssueText, setContentIssueText] = useState(toText(initialRules.keywords.contentIssue));
  const [networkText, setNetworkText] = useState(toText(initialRules.keywords.transientNetwork));
  const [busyText, setBusyText] = useState(toText(initialRules.keywords.platformBusy));
  const [accountRiskText, setAccountRiskText] = useState(toText(initialRules.keywords.accountRisk));
  const [scoreSuccess, setScoreSuccess] = useState(String(initialRules.score.success));
  const [scoreTarget, setScoreTarget] = useState(String(initialRules.score.targetIssue));
  const [scoreContent, setScoreContent] = useState(String(initialRules.score.contentIssue));
  const [scoreNetwork, setScoreNetwork] = useState(String(initialRules.score.transientNetwork));
  const [scoreBusy, setScoreBusy] = useState(String(initialRules.score.platformBusy));
  const [scoreAccountRisk, setScoreAccountRisk] = useState(String(initialRules.score.accountRisk));
  const [scoreUnknown, setScoreUnknown] = useState(String(initialRules.score.unknownFailure));
  const [markRiskyAt, setMarkRiskyAt] = useState(String(initialRules.threshold.markRiskyAt));
  const [recoverActiveAt, setRecoverActiveAt] = useState(String(initialRules.threshold.recoverActiveAt));
  const [maxRiskLevel, setMaxRiskLevel] = useState(String(initialRules.threshold.maxRiskLevel));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const preview = useMemo(
    () => ({
      accountRisk: Number(scoreAccountRisk) || 0,
      network: Number(scoreNetwork) || 0,
      busy: Number(scoreBusy) || 0,
      target: Number(scoreTarget) || 0,
    }),
    [scoreAccountRisk, scoreBusy, scoreNetwork, scoreTarget],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: RiskRules = {
      keywords: {
        targetIssue: fromText(targetIssueText),
        contentIssue: fromText(contentIssueText),
        transientNetwork: fromText(networkText),
        platformBusy: fromText(busyText),
        accountRisk: fromText(accountRiskText),
      },
      score: {
        success: Number(scoreSuccess),
        targetIssue: Number(scoreTarget),
        contentIssue: Number(scoreContent),
        transientNetwork: Number(scoreNetwork),
        platformBusy: Number(scoreBusy),
        accountRisk: Number(scoreAccountRisk),
        unknownFailure: Number(scoreUnknown),
      },
      threshold: {
        markRiskyAt: Number(markRiskyAt),
        recoverActiveAt: Number(recoverActiveAt),
        maxRiskLevel: Number(maxRiskLevel),
      },
    };

    if (payload.threshold.recoverActiveAt >= payload.threshold.markRiskyAt) {
      setError("恢复阈值必须小于标记风险阈值");
      setMessage(null);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setMessage(null);

      const response = await fetch("/api/risk-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "保存风控规则失败");
      }

      setMessage(result.message || "风控规则已保存");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存风控规则失败");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-medium">风控分类规则</h3>
        <p className="mt-1 text-sm text-slate-500">可在线调整关键词和分值，避免把“目标问题”误算成账号风险。</p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">目标问题关键词（每行一条）</span>
            <textarea value={targetIssueText} onChange={(event) => setTargetIssueText(event.target.value)} className="h-36 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">账号风险关键词（每行一条）</span>
            <textarea value={accountRiskText} onChange={(event) => setAccountRiskText(event.target.value)} className="h-36 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">网络问题关键词</span>
            <textarea value={networkText} onChange={(event) => setNetworkText(event.target.value)} className="h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">平台繁忙关键词</span>
            <textarea value={busyText} onChange={(event) => setBusyText(event.target.value)} className="h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">文案问题关键词</span>
            <textarea value={contentIssueText} onChange={(event) => setContentIssueText(event.target.value)} className="h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block"><span className="mb-1 block text-sm text-slate-700">成功分值</span><input value={scoreSuccess} onChange={(e) => setScoreSuccess(e.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-sm text-slate-700">目标问题分值</span><input value={scoreTarget} onChange={(e) => setScoreTarget(e.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-sm text-slate-700">文案问题分值</span><input value={scoreContent} onChange={(e) => setScoreContent(e.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-sm text-slate-700">网络问题分值</span><input value={scoreNetwork} onChange={(e) => setScoreNetwork(e.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-sm text-slate-700">平台繁忙分值</span><input value={scoreBusy} onChange={(e) => setScoreBusy(e.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-sm text-slate-700">账号风险分值</span><input value={scoreAccountRisk} onChange={(e) => setScoreAccountRisk(e.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-sm text-slate-700">未知失败分值</span><input value={scoreUnknown} onChange={(e) => setScoreUnknown(e.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-sm text-slate-700">标记 RISKY 阈值</span><input value={markRiskyAt} onChange={(e) => setMarkRiskyAt(e.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-sm text-slate-700">恢复 ACTIVE 阈值</span><input value={recoverActiveAt} onChange={(e) => setRecoverActiveAt(e.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-sm text-slate-700">最大风险分值</span><input value={maxRiskLevel} onChange={(e) => setMaxRiskLevel(e.target.value)} type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        </div>

        <p className="text-xs text-slate-500">
          当前预览：账号风险 +{preview.accountRisk}，网络 +{preview.network}，平台繁忙 +{preview.busy}，目标问题 +{preview.target}
        </p>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

        <button type="submit" disabled={submitting} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? "保存中..." : "保存风控规则"}
        </button>
      </form>
    </section>
  );
}
