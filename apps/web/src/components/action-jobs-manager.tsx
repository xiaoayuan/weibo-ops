"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";

import { AppNotice } from "@/components/app-notice";
import { SectionHeader } from "@/components/section-header";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";
import type { ActionJob } from "@/lib/app-data";
import { EmptyState } from "@/components/empty-state";

type Urgency = "S" | "A" | "B";

type ListJobsResponse = {
  success: boolean;
  message?: string;
  data: ActionJob[];
};

type JobConfig = {
  accountIds: string[];
  poolItemIds: string[];
  targetNodeId: string | null;
  urgency: Urgency;
  forecast?: {
    targetMinutes: number;
    limitMinutes: number;
    riskLevel: string;
    notes: string[];
  };
  aiRisk?: {
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    summary: string;
    reasons: string[];
    suggestions: string[];
    canBlock: boolean;
  };
};

function truncateJobId(id: string, length: number = 12): string {
  return id.length > length ? `${id.slice(0, length)}…` : id;
}

function getJobTypeText(jobType: ActionJob["jobType"]): string {
  return jobType === "COMMENT_LIKE_BATCH" ? "控评点赞" : "轮转转发";
}

function getJobStatusText(status: ActionJob["status"]): string {
  const map: Record<ActionJob["status"], string> = {
    PENDING: "待执行",
    RUNNING: "执行中",
    SUCCESS: "成功",
    PARTIAL_FAILED: "部分失败",
    FAILED: "失败",
    CANCELLED: "已取消",
  };
  return map[status] ?? status;
}

function getStatusBadgeTone(status: ActionJob["status"]): "neutral" | "success" | "info" | "warning" | "danger" {
  switch (status) {
    case "PENDING": return "warning";
    case "RUNNING": return "info";
    case "SUCCESS": return "success";
    case "FAILED":
    case "PARTIAL_FAILED": return "danger";
    case "CANCELLED": return "neutral";
    default: return "neutral";
  }
}

function computeTotalSteps(job: ActionJob): number {
  const config = job.config as JobConfig | null;
  if (!config) return 0;
  return job.accountRuns.reduce((sum, run) => sum + run.totalSteps, 0);
}

function computeNodeId(job: ActionJob): string {
  const config = job.config as JobConfig | null;
  if (!config) return "-";
  return config.targetNodeId ?? "自动分配";
}

export function ActionJobsManager({ initialJobs }: { initialJobs: ActionJob[] }) {
  const [jobs, setJobs] = useState<ActionJob[]>(initialJobs);
  const [loading, setLoading] = useState(false);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refreshJobs() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/action-jobs", { cache: "no-store" });
      const result: ListJobsResponse = await response.json();
      if (!response.ok) throw new Error(result.message ?? "刷新批次失败");
      setJobs(result.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "刷新批次失败");
    } finally {
      setLoading(false);
    }
  }

  async function stopJob(id: string) {
    if (!window.confirm("确认停止该批次吗？")) return;
    try {
      setStoppingId(id);
      setError(null);
      setNotice(null);
      const response = await fetch(`/api/action-jobs/${id}/stop`, { method: "POST" });
      const result = await response.json() as { success: boolean; message?: string; data?: ActionJob };
      if (!response.ok) throw new Error(result.message ?? "停止批次失败");
      setJobs((current) => current.map((job) => (job.id === id && result.data ? result.data : job)));
      setNotice("批次已停止");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "停止批次失败");
    } finally {
      setStoppingId(null);
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <SurfaceCard>
        <SectionHeader
          title="批次管理"
          description="查看最近创建的控评和轮转批次，支持停止待执行或执行中的批次。"
          action={
            <button
              type="button"
              onClick={() => void refreshJobs()}
              disabled={loading}
              className="app-button app-button-secondary"
            >
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? "刷新中" : "刷新"}
            </button>
          }
        />

        {error ? <AppNotice tone="error" className="mt-4">{error}</AppNotice> : null}
        {notice ? <AppNotice tone="success" className="mt-4">{notice}</AppNotice> : null}

        {jobs.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title="暂无批次"
              description="通过控评批次创建或轮转转发表单创建批次后，这里将展示任务列表。"
            />
          </div>
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[1100px]">
              <thead>
                <tr>
                  <th>批次ID</th>
                  <th>类型</th>
                  <th>账号数</th>
                  <th>总步骤</th>
                  <th>状态</th>
                  <th>执行节点</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const totalSteps = computeTotalSteps(job);
                  const nodeId = computeNodeId(job);
                  const canStop = job.status === "PENDING" || job.status === "RUNNING";

                  return (
                    <tr key={job.id}>
                      <td className="font-mono text-xs text-app-text-soft">{truncateJobId(job.id)}</td>
                      <td className="font-medium text-app-text-strong">{getJobTypeText(job.jobType)}</td>
                      <td>{job.accountRuns.length}</td>
                      <td>{totalSteps}</td>
                      <td>
                        <StatusBadge tone={getStatusBadgeTone(job.status)}>
                          {getJobStatusText(job.status)}
                        </StatusBadge>
                      </td>
                      <td className="font-mono text-xs text-app-text-soft">{nodeId}</td>
                      <td className="text-xs text-app-text-soft">
                        {new Date(job.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => void stopJob(job.id)}
                          disabled={!canStop || stoppingId === job.id}
                          className="app-button app-button-secondary h-9 px-4 text-xs text-app-danger hover:border-app-danger/30 hover:text-app-danger disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {stoppingId === job.id ? "停止中" : "停止"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableShell>
        )}
      </SurfaceCard>
    </div>
  );
}
