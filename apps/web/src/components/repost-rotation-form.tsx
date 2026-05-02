"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { AppNotice } from "@/components/app-notice";
import { SectionHeader } from "@/components/section-header";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";
import type { WeiboAccount } from "@/lib/app-data";

const REPOST_INTERVAL_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "不间隔" },
  { value: 3, label: "3秒" },
  { value: 5, label: "5秒" },
  { value: 10, label: "10秒" },
];

const URGENCY_OPTIONS: { value: "S" | "A" | "B"; label: string }[] = [
  { value: "S", label: "S（默认）" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
];

type Urgency = "S" | "A" | "B";

type AiRisk = {
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  reasons: string[];
  suggestions: string[];
  canBlock: boolean;
};

type Forecast = {
  targetMinutes: number;
  limitMinutes: number;
  riskLevel: string;
  notes: string[];
};

type CreateJobResponse = {
  success: boolean;
  message?: string;
  data: {
    id: string;
    [key: string]: unknown;
  };
  workerId: string;
};

export function RepostRotationForm({ initialAccounts }: { initialAccounts: WeiboAccount[] }) {
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(() => new Set(initialAccounts.filter((account) => account.status === "ACTIVE").map((account) => account.id)));
  const [targetNodeId, setTargetNodeId] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [times, setTimes] = useState(5);
  const [intervalSec, setIntervalSec] = useState(3);
  const [urgency, setUrgency] = useState<Urgency>("S");
  const [copywritingTexts, setCopywritingTexts] = useState("");
  const [aiRiskJson, setAiRiskJson] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ jobId: string; workerId: string } | null>(null);

  const activeAccounts = initialAccounts.filter((account) => account.status === "ACTIVE");

  function toggleAccount(id: string) {
    setSelectedAccountIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedAccountIds(new Set(activeAccounts.map((account) => account.id)));
  }

  function deselectAll() {
    setSelectedAccountIds(new Set());
  }

  async function handleCreateJob() {
    if (selectedAccountIds.size === 0) {
      setError("请选择至少一个账号");
      return;
    }
    if (!targetUrl.trim()) {
      setError("请输入目标微博链接");
      return;
    }
    if (times < 1 || times > 20) {
      setError("转发次数需在 1~20 之间");
      return;
    }

    setError(null);
    setResult(null);
    setSubmitting(true);

    try {
      const parsedCopywriting = copywritingTexts.trim()
        ? copywritingTexts.split("\n").map((line) => line.trim()).filter((line) => line.length > 0)
        : undefined;

      let parsedAiRisk: AiRisk | undefined;
      if (aiRiskJson.trim()) {
        try {
          parsedAiRisk = JSON.parse(aiRiskJson) as AiRisk;
        } catch {
          throw new Error("AI风险评估 JSON 格式不正确");
        }
      }

      const body = {
        accountIds: Array.from(selectedAccountIds),
        targetNodeId: targetNodeId.trim() || null,
        targetUrl: targetUrl.trim(),
        times,
        intervalSec,
        copywritingTexts: parsedCopywriting,
        urgency,
        aiRisk: parsedAiRisk,
      };

      const response = await fetch("/api/action-jobs/repost-rotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const resultData = (await response.json()) as CreateJobResponse;
      if (!response.ok) throw new Error(resultData.message ?? "创建轮转转发任务失败");

      setResult({ jobId: resultData.data.id, workerId: resultData.workerId });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建轮转转发任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <SurfaceCard>
        <SectionHeader
          title="创建轮转转发任务"
          description="选择账号和目标微博，配置转发次数和间隔，创建轮转转发批次。"
        />

        {error ? <AppNotice tone="error" className="mt-4">{error}</AppNotice> : null}

        {result ? (
          <AppNotice tone="success" className="mt-4">
            创建成功！批次ID：{result.jobId}，执行节点：{result.workerId}
          </AppNotice>
        ) : null}

        <div className="mt-5 space-y-4">
          {/* 账号多选 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-app-text-strong">选择账号 *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-app-brand hover:underline"
                >
                  全选
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-xs text-app-text-soft hover:underline"
                >
                  取消全选
                </button>
              </div>
            </div>
            <div className="max-h-[200px] overflow-y-auto rounded-md border border-app-border bg-app-surface-subtle p-2 space-y-1">
              {activeAccounts.length === 0 ? (
                <p className="text-xs text-app-text-soft px-2 py-1">无活跃账号</p>
              ) : (
                activeAccounts.map((account) => (
                  <label
                    key={account.id}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-app-surface"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAccountIds.has(account.id)}
                      onChange={() => toggleAccount(account.id)}
                      className="accent-app-brand"
                    />
                    <span className="text-app-text-strong">{account.nickname}</span>
                    <span className="text-app-text-soft text-xs">{account.username}</span>
                    {account.proxy ? (
                      <StatusBadge tone="neutral">{account.proxy.ip}</StatusBadge>
                    ) : null}
                  </label>
                ))
              )}
            </div>
            <p className="mt-1 text-xs text-app-text-soft">已选 {selectedAccountIds.size} 个账号</p>
          </div>

          {/* 目标微博链接 */}
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">目标微博链接 *</label>
            <input
              type="text"
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              placeholder="https://m.weibo.cn/detail/..."
              className="app-input w-full"
            />
          </div>

          {/* 转发次数 & 间隔 */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-1">转发次数（1~20）</label>
              <input
                type="number"
                min={1}
                max={20}
                value={times}
                onChange={(event) => setTimes(Number(event.target.value))}
                className="app-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-1">转发间隔</label>
              <select
                value={intervalSec}
                onChange={(event) => setIntervalSec(Number(event.target.value))}
                className="app-select w-full"
              >
                {REPOST_INTERVAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 执行节点 & 紧急度 */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-1">执行节点</label>
              <input
                type="text"
                value={targetNodeId}
                onChange={(event) => setTargetNodeId(event.target.value)}
                placeholder="留空自动分配"
                className="app-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-1">紧急度</label>
              <select
                value={urgency}
                onChange={(event) => setUrgency(event.target.value as Urgency)}
                className="app-select w-full"
              >
                {URGENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 文案列表 */}
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">文案列表（可选，每行一条）</label>
            <textarea
              value={copywritingTexts}
              onChange={(event) => setCopywritingTexts(event.target.value)}
              rows={4}
              placeholder={"第一条转发文案\n第二条转发文案\n..."}
              className="app-input w-full"
            />
          </div>

          {/* AI 风险评估 JSON */}
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">AI 风险评估 JSON（可选）</label>
            <textarea
              value={aiRiskJson}
              onChange={(event) => setAiRiskJson(event.target.value)}
              rows={3}
              placeholder='{"riskLevel":"LOW","summary":"","reasons":[],"suggestions":[],"canBlock":false}'
              className="app-input w-full font-mono text-xs"
            />
          </div>

          {/* 创建按钮 */}
          <button
            type="button"
            onClick={() => void handleCreateJob()}
            disabled={submitting}
            className="app-button app-button-primary h-11 w-full md:w-auto"
          >
            {submitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            {submitting ? "创建中" : "创建轮转转发任务"}
          </button>
        </div>
      </SurfaceCard>
    </div>
  );
}