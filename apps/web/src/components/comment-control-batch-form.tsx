"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { AppNotice } from "@/components/app-notice";
import { SectionHeader } from "@/components/section-header";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";
import type { CommentPoolItem, WeiboAccount } from "@/lib/app-data";
import { formatDateTime } from "@/lib/date";

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

type CommentPoolResponse = {
  success: boolean;
  message?: string;
  data: CommentPoolItem[];
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

const URGENCY_OPTIONS: { value: Urgency; label: string }[] = [
  { value: "S", label: "S（默认）" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
];

export function CommentControlBatchForm({ initialAccounts }: { initialAccounts: WeiboAccount[] }) {
  const [commentPoolItems, setCommentPoolItems] = useState<CommentPoolItem[]>([]);
  const [loadingPool, setLoadingPool] = useState(true);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(() => new Set(initialAccounts.filter((account) => account.status === "ACTIVE").map((account) => account.id)));
  const [selectedPoolItemIds, setSelectedPoolItemIds] = useState<Set<string>>(() => new Set());
  const [targetNodeId, setTargetNodeId] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("S");
  const [aiRiskJson, setAiRiskJson] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [result, setResult] = useState<{ jobId: string; workerId: string } | null>(null);

  const activeAccounts = initialAccounts.filter((account) => account.status === "ACTIVE");

  useEffect(() => {
    let cancelled = false;

    async function loadCommentPool() {
      try {
        setLoadingPool(true);
        setPoolError(null);
        const response = await fetch("/api/comment-pool", { cache: "no-store" });
        const result = (await response.json()) as CommentPoolResponse;
        if (!response.ok) throw new Error(result.message ?? "加载评论池失败");
        if (!cancelled) setCommentPoolItems(result.data);
      } catch (reason) {
        if (!cancelled) setPoolError(reason instanceof Error ? reason.message : "加载评论池失败");
      } finally {
        if (!cancelled) setLoadingPool(false);
      }
    }

    void loadCommentPool();

    return () => {
      cancelled = true;
    };
  }, []);

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

  function togglePoolItem(id: string) {
    setSelectedPoolItemIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllAccounts() {
    setSelectedAccountIds(new Set(activeAccounts.map((account) => account.id)));
  }

  function deselectAllAccounts() {
    setSelectedAccountIds(new Set());
  }

  function selectAllPoolItems() {
    setSelectedPoolItemIds(new Set(availablePoolItems.map((item) => item.id)));
  }

  function deselectAllPoolItems() {
    setSelectedPoolItemIds(new Set());
  }

  async function handleCreateJob() {
    if (selectedAccountIds.size === 0) {
      setError("请选择至少一个账号");
      return;
    }
    if (selectedPoolItemIds.size === 0) {
      setError("请选择至少一条评论链接");
      return;
    }

    setError(null);
    setResult(null);
    setSubmitting(true);

    try {
      let parsedAiRisk: AiRisk | undefined;
      if (aiRiskJson.trim()) {
        try {
          parsedAiRisk = JSON.parse(aiRiskJson) as AiRisk;
        } catch {
          throw new Error("AI风险评估 JSON 格式不正确");
        }
      }

      const body: {
        accountIds: string[];
        poolItemIds: string[];
        targetNodeId: string | null;
        urgency: Urgency;
        forecast?: Forecast;
        aiRisk?: AiRisk;
      } = {
        accountIds: Array.from(selectedAccountIds),
        poolItemIds: Array.from(selectedPoolItemIds),
        targetNodeId: targetNodeId.trim() || null,
        urgency,
        aiRisk: parsedAiRisk,
      };

      const response = await fetch("/api/action-jobs/comment-like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const resultData = (await response.json()) as CreateJobResponse;
      if (!response.ok) throw new Error(resultData.message ?? "创建控评批次失败");

      setResult({ jobId: resultData.data.id, workerId: resultData.workerId });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建控评批次失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <SurfaceCard>
        <SectionHeader
          title="创建控评批次"
          description="选择账号和评论池链接，创建控评点赞批次。执行节点留空时由后端自动分配。"
        />

        {error ? <AppNotice tone="error" className="mt-4">{error}</AppNotice> : null}
        {poolError ? <AppNotice tone="error" className="mt-4">{poolError}</AppNotice> : null}

        {result ? (
          <AppNotice tone="success" className="mt-4">
            创建成功！批次ID：{result.jobId}，执行节点：{result.workerId}。请手动刷新批次列表查看最新状态。
          </AppNotice>
        ) : null}

        <div className="mt-5 space-y-4">
          {/* 账号多选 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-app-text-strong">选择账号 *</label>
              <div className="flex gap-2">
                <button type="button" onClick={selectAllAccounts} className="text-xs text-app-brand hover:underline">全选</button>
                <button type="button" onClick={deselectAllAccounts} className="text-xs text-app-text-soft hover:underline">取消全选</button>
              </div>
            </div>
            <div className="max-h-[200px] overflow-y-auto rounded-md border border-app-border bg-app-surface-subtle p-2 space-y-1">
              {activeAccounts.length === 0 ? (
                <p className="text-xs text-app-text-soft px-2 py-1">无活跃账号</p>
              ) : (
                activeAccounts.map((account) => (
                  <label key={account.id} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-app-surface">
                    <input
                      type="checkbox"
                      checked={selectedAccountIds.has(account.id)}
                      onChange={() => toggleAccount(account.id)}
                      className="accent-app-brand"
                    />
                    <span className="text-app-text-strong">{account.nickname}</span>
                    <span className="text-app-text-soft text-xs">{account.username}</span>
                    {account.proxy ? <StatusBadge tone="neutral">{account.proxy.ip}</StatusBadge> : null}
                  </label>
                ))
              )}
            </div>
            <p className="mt-1 text-xs text-app-text-soft">已选 {selectedAccountIds.size} 个账号</p>
          </div>

          {/* 评论池链接 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-app-text-strong">选择控评评论链接 *</label>
              <div className="flex gap-2">
                <button type="button" onClick={selectAllPoolItems} className="text-xs text-app-brand hover:underline">全选</button>
                <button type="button" onClick={deselectAllPoolItems} className="text-xs text-app-text-soft hover:underline">取消全选</button>
              </div>
            </div>
            <TableShell>
              <table className="app-table min-w-[900px]">
                <thead>
                  <tr>
                    <th className="w-12">选择</th>
                    <th>评论链接</th>
                    <th>关键词</th>
                    <th>状态</th>
                    <th>热度</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingPool ? (
                    <tr>
                      <td colSpan={5} className="text-center text-app-text-soft py-6">
                        <LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        加载评论池中...
                      </td>
                    </tr>
                  ) : availablePoolItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-app-text-soft py-6">暂无可用评论链接</td>
                    </tr>
                  ) : (
                    availablePoolItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedPoolItemIds.has(item.id)}
                            onChange={() => togglePoolItem(item.id)}
                            className="accent-app-brand"
                          />
                        </td>
                        <td className="max-w-[380px] truncate font-mono text-xs text-app-text-soft">{item.link}</td>
                        <td>{item.keyword}</td>
                        <td><StatusBadge tone={getCommentPoolStatusTone(item.status)}>{item.status}</StatusBadge></td>
                        <td>{item.heat}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableShell>
            <p className="mt-1 text-xs text-app-text-soft">已选 {selectedPoolItemIds.size} 条评论链接</p>
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
            disabled={submitting || loadingPool}
            className="app-button app-button-primary h-11 w-full md:w-auto"
          >
            {submitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            {submitting ? "创建中" : "创建控评批次"}
          </button>
        </div>
      </SurfaceCard>
    </div>
  );
}