"use client";

import { useMemo, useState } from "react";

import { AppNotice } from "@/components/app-notice";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";
import type { ExecutionLog } from "@/lib/app-data";
import { formatDateTime } from "@/lib/date";
import { readJsonResponse } from "@/lib/http";

type UserOption = { id: string; username: string };
type LogStage = "UNKNOWN" | "PRECHECK_BLOCKED" | "PRECHECK_PASSED" | "ACTION_PENDING";
type AiRiskAssessment = {
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  reasons: string[];
  suggestions: string[];
  canBlock: boolean;
};

type AccountSummaryRow = {
  id: string;
  accountText: string;
  total: number;
  failed: number;
  blocked: number;
  latestExecutedAt: string;
  details: string[];
  topReason: string | null;
};

type SummaryRow = {
  id: string;
  actionText: string;
  total: number;
  failed: number;
  blocked: number;
  latestExecutedAt: string;
  details: string[];
  accountRows: AccountSummaryRow[];
};

function readStageFromPayload(payload: unknown): LogStage {
  if (!payload || typeof payload !== "object") {
    return "UNKNOWN";
  }

  const stage = (payload as Record<string, unknown>).stage;
  return stage === "PRECHECK_BLOCKED" || stage === "PRECHECK_PASSED" || stage === "ACTION_PENDING" ? stage : "UNKNOWN";
}

function getLogStage(log: ExecutionLog): LogStage {
  const requestStage = readStageFromPayload(log.requestPayload);
  if (requestStage !== "UNKNOWN") return requestStage;
  return readStageFromPayload(log.responsePayload);
}

function getActionText(log: ExecutionLog) {
  const payload = log.requestPayload && typeof log.requestPayload === "object" ? (log.requestPayload as Record<string, unknown>) : null;

  if (log.actionType === "ACTION_JOB_SCHEDULED") {
    return payload?.jobType === "REPOST_ROTATION" ? "轮转任务入队" : "控评任务入队";
  }

  if (log.actionType === "PLAN_DELAYED") {
    return "计划延后执行";
  }

  if (log.actionType === "INTERACTION_DELAYED") {
    return "互动任务延后执行";
  }

  if (log.actionType === "INTERACTION_EXECUTE_PRECHECKED" || log.actionType === "INTERACTION_EXECUTE_BLOCKED") {
    const actionType = payload?.actionType;
    if (actionType === "LIKE") return "互动点赞";
    if (actionType === "POST") return "互动转发";
    if (actionType === "COMMENT") return "互动回复";
  }

  return log.actionType;
}

function getDetailText(log: ExecutionLog) {
  const payload = log.requestPayload && typeof log.requestPayload === "object" ? (log.requestPayload as Record<string, unknown>) : null;
  const responsePayload = log.responsePayload && typeof log.responsePayload === "object" ? (log.responsePayload as Record<string, unknown>) : null;

  if (typeof log.errorMessage === "string" && log.errorMessage) {
    return log.errorMessage;
  }

  if (typeof payload?.targetUrl === "string") {
    return payload.targetUrl;
  }

  if (typeof payload?.delaySeconds === "number") {
    return `已延后 ${payload.delaySeconds} 秒执行`;
  }

  if (typeof payload?.earliestStartAt === "string") {
    return `最早执行时间：${formatDateTime(payload.earliestStartAt)}`;
  }

  if (typeof responsePayload?.summary === "string") {
    return responsePayload.summary;
  }

  if (typeof responsePayload?.message === "string") {
    return responsePayload.message;
  }

  return "-";
}

function getStageText(stage: LogStage) {
  if (stage === "PRECHECK_BLOCKED") return "预检拦截";
  if (stage === "PRECHECK_PASSED") return "预检通过";
  if (stage === "ACTION_PENDING") return "动作已发起";
  return "未标记";
}

function getResultTone(log: ExecutionLog): "success" | "danger" | "warning" {
  if (!log.success) return "danger";
  return getLogStage(log) === "PRECHECK_BLOCKED" ? "warning" : "success";
}

function getOutcomeMeta(log: ExecutionLog) {
  const detail = getDetailText(log);
  const actionText = getActionText(log);

  if (log.actionType === "PLAN_DELAYED" || log.actionType === "INTERACTION_DELAYED") {
    return { label: "延后执行", tone: "warning" as const };
  }

  if (actionText.includes("入队") || log.actionType === "PLAN_SCHEDULED" || log.actionType === "INTERACTION_SCHEDULED" || log.actionType === "ACTION_JOB_SCHEDULED") {
    const payload = log.requestPayload && typeof log.requestPayload === "object" ? (log.requestPayload as Record<string, unknown>) : null;
    if (payload?.queueState === "DELAYED" || detail.includes("最早执行时间") || detail.includes("延后")) {
      return { label: "延后执行", tone: "warning" as const };
    }
    return { label: "已入队", tone: "info" as const };
  }

  if (getLogStage(log) === "PRECHECK_BLOCKED") {
    return { label: "预检拦截", tone: "warning" as const };
  }

  if (log.success) {
    return { label: "执行成功", tone: "success" as const };
  }

  return { label: "执行失败", tone: "danger" as const };
}

function buildSummaryRows(logs: ExecutionLog[]) {
  const rows = new Map<string, SummaryRow>();

  for (const log of logs) {
    const actionText = getActionText(log);
    const detail = getDetailText(log);
    const latestExecutedAt = log.executedAt;
    const accountId = log.account?.id || "system";
    const accountText = log.account?.nickname || "系统";
    const blocked = getLogStage(log) === "PRECHECK_BLOCKED" ? 1 : 0;

    if (!rows.has(actionText)) {
      rows.set(actionText, {
        id: actionText,
        actionText,
        total: 0,
        failed: 0,
        blocked: 0,
        latestExecutedAt,
        details: [],
        accountRows: [],
      });
    }

    const row = rows.get(actionText)!;
    row.total += 1;
    row.failed += log.success ? 0 : 1;
    row.blocked += blocked;
    if (new Date(latestExecutedAt).getTime() > new Date(row.latestExecutedAt).getTime()) {
      row.latestExecutedAt = latestExecutedAt;
    }
    if (detail !== "-" && !row.details.includes(detail) && row.details.length < 3) {
      row.details.push(detail);
    }

    let accountRow = row.accountRows.find((item) => item.id === accountId);
    if (!accountRow) {
      accountRow = {
        id: accountId,
        accountText,
        total: 0,
        failed: 0,
        blocked: 0,
        latestExecutedAt,
        details: [],
        topReason: null,
      };
      row.accountRows.push(accountRow);
    }

    accountRow.total += 1;
    accountRow.failed += log.success ? 0 : 1;
    accountRow.blocked += blocked;
    if (new Date(latestExecutedAt).getTime() > new Date(accountRow.latestExecutedAt).getTime()) {
      accountRow.latestExecutedAt = latestExecutedAt;
    }
    if (detail !== "-" && !accountRow.details.includes(detail) && accountRow.details.length < 2) {
      accountRow.details.push(detail);
    }
    if (!log.success && !accountRow.topReason) {
      accountRow.topReason = log.errorMessage || detail;
    }
  }

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      accountRows: row.accountRows.sort((a, b) => new Date(b.latestExecutedAt).getTime() - new Date(a.latestExecutedAt).getTime()),
    }))
    .sort((a, b) => new Date(b.latestExecutedAt).getTime() - new Date(a.latestExecutedAt).getTime());
}

export function LogsManager({ initialLogs, users, isAdmin }: { initialLogs: ExecutionLog[]; users: UserOption[]; isAdmin: boolean }) {
  const [viewMode, setViewMode] = useState<"SUMMARY" | "DETAIL">("SUMMARY");
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [resultFilter, setResultFilter] = useState<"ALL" | "SUCCESS" | "FAILED">("ALL");
  const [stageFilter, setStageFilter] = useState<"ALL" | LogStage>("ALL");
  const [userFilter, setUserFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [aiSummaryMap, setAiSummaryMap] = useState<Record<string, AiRiskAssessment>>({});
  const [aiError, setAiError] = useState<string | null>(null);

  const actionOptions = useMemo(() => Array.from(new Set(initialLogs.map((log) => log.actionType))), [initialLogs]);

  const filteredLogs = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return initialLogs.filter((log) => {
      const matchesKeyword =
        normalizedKeyword === "" ||
        log.actionType.toLowerCase().includes(normalizedKeyword) ||
        getActionText(log).toLowerCase().includes(normalizedKeyword) ||
        (log.account?.nickname || "").toLowerCase().includes(normalizedKeyword) ||
        (log.errorMessage || "").toLowerCase().includes(normalizedKeyword);
      const matchesAction = actionFilter === "ALL" || log.actionType === actionFilter;
      const matchesResult = resultFilter === "ALL" || (resultFilter === "SUCCESS" ? log.success : !log.success);
      const matchesStage = stageFilter === "ALL" || getLogStage(log) === stageFilter;
      const matchesUser = !isAdmin || userFilter === "ALL" || log.account?.ownerUserId === userFilter;
      const logDate = new Date(log.executedAt);
      const matchesStartDate = startDate === "" || logDate >= new Date(`${startDate}T00:00:00`);
      const matchesEndDate = endDate === "" || logDate <= new Date(`${endDate}T23:59:59`);
      return matchesKeyword && matchesAction && matchesResult && matchesStage && matchesUser && matchesStartDate && matchesEndDate;
    });
  }, [actionFilter, endDate, initialLogs, isAdmin, keyword, resultFilter, stageFilter, startDate, userFilter]);

  const summaryRows = useMemo(() => buildSummaryRows(filteredLogs), [filteredLogs]);

  async function fetchAiSummary(key: string, actionText: string, detailText: string, topReason?: string | null) {
    if (aiSummaryMap[key]) {
      return;
    }

    try {
      setAiError(null);
      const response = await fetch("/api/ai-risk/log-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionText, detailText, topReason }),
      });
      const result = await readJsonResponse<{ success: boolean; data?: AiRiskAssessment; message?: string }>(response);

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || "AI 总结失败");
      }

      setAiSummaryMap((current) => ({ ...current, [key]: result.data! }));
    } catch (reason) {
      setAiError(reason instanceof Error ? reason.message : "AI 总结失败");
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader eyebrow="可观测性" title="执行日志分析" description="保留最近日志明细，同时补上筛选、按账号展开汇总和 AI 总结，方便快速定位失败原因。" />

      <SurfaceCard>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setViewMode("SUMMARY")} className={`app-button ${viewMode === "SUMMARY" ? "app-button-primary" : "app-button-secondary"}`}>汇总视图</button>
          <button type="button" onClick={() => setViewMode("DETAIL")} className={`app-button ${viewMode === "DETAIL" ? "app-button-primary" : "app-button-secondary"}`}>明细视图</button>
        </div>
        <div className={`mt-5 grid gap-3 ${isAdmin ? "md:grid-cols-7" : "md:grid-cols-6"}`}>
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} className="app-input" placeholder="搜索动作、账号、错误信息" />
          <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} className="app-input">
            <option value="ALL">全部动作</option>
            {actionOptions.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
          <select value={resultFilter} onChange={(event) => setResultFilter(event.target.value as "ALL" | "SUCCESS" | "FAILED")} className="app-input">
            <option value="ALL">全部结果</option>
            <option value="SUCCESS">仅成功</option>
            <option value="FAILED">仅失败</option>
          </select>
          <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as "ALL" | LogStage)} className="app-input">
            <option value="ALL">全部阶段</option>
            <option value="PRECHECK_BLOCKED">预检拦截</option>
            <option value="PRECHECK_PASSED">预检通过</option>
            <option value="ACTION_PENDING">动作已发起</option>
            <option value="UNKNOWN">未标记</option>
          </select>
          {isAdmin ? (
            <select value={userFilter} onChange={(event) => setUserFilter(event.target.value)} className="app-input">
              <option value="ALL">全部用户</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
            </select>
          ) : null}
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="app-input" />
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="app-input" />
        </div>
      </SurfaceCard>

      {aiError ? <AppNotice tone="error">{aiError}</AppNotice> : null}

      <SurfaceCard>
        <SectionHeader title={viewMode === "SUMMARY" ? "汇总视图" : "明细视图"} description={`当前命中 ${viewMode === "SUMMARY" ? summaryRows.length : filteredLogs.length} 条记录`} />
        {viewMode === "SUMMARY" ? (
          summaryRows.length === 0 ? (
            <div className="mt-5"><EmptyState title="当前筛选下暂无汇总数据" description="调整筛选条件后再试。" /></div>
          ) : (
            <TableShell className="mt-5">
              <table className="app-table min-w-[1180px]">
                <thead>
                  <tr><th>动作</th><th>总数</th><th>失败</th><th>预检拦截</th><th>说明</th><th>最近时间</th><th>AI</th></tr>
                </thead>
                <tbody>
                  {summaryRows.flatMap((row) => {
                    const expanded = expandedSummaryId === row.id;
                    return [
                      <tr key={row.id}>
                        <td className="font-medium text-app-text-strong">
                          <button type="button" onClick={() => setExpandedSummaryId(expanded ? null : row.id)} className="mr-3 text-xs text-app-accent hover:text-app-text-strong">{expanded ? "收起" : "展开"}</button>
                          {row.actionText}
                        </td>
                        <td>{row.total}</td>
                        <td>{row.failed}</td>
                        <td>{row.blocked}</td>
                        <td className="max-w-[320px] text-xs text-app-text-soft">{row.details.join(" / ") || "-"}</td>
                        <td>{formatDateTime(row.latestExecutedAt)}</td>
                        <td>
                          <button type="button" onClick={() => void fetchAiSummary(row.id, row.actionText, row.details.join(" / ") || row.actionText)} className="text-xs text-app-accent hover:text-app-text-strong">AI 总结</button>
                          {aiSummaryMap[row.id] ? <p className="mt-2 max-w-[240px] text-xs text-app-text-soft">{aiSummaryMap[row.id].summary}</p> : null}
                        </td>
                      </tr>,
                      expanded ? (
                        <tr key={`${row.id}-expanded`}>
                          <td colSpan={7} className="p-0">
                            <div className="grid gap-3 border-t border-app-line bg-app-panel-muted p-4 md:grid-cols-2 xl:grid-cols-3">
                              {row.accountRows.map((accountRow) => {
                                const aiKey = `${row.id}:${accountRow.id}`;
                                return (
                                  <div key={accountRow.id} className="rounded-[18px] border border-app-line bg-app-panel p-4">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="font-medium text-app-text-strong">{accountRow.accountText}</p>
                                      <span className="text-xs text-app-text-soft">{formatDateTime(accountRow.latestExecutedAt)}</span>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <StatusBadge tone="info">总数 {accountRow.total}</StatusBadge>
                                      <StatusBadge tone={accountRow.failed > 0 ? "danger" : "success"}>失败 {accountRow.failed}</StatusBadge>
                                      <StatusBadge tone={accountRow.blocked > 0 ? "warning" : "neutral"}>拦截 {accountRow.blocked}</StatusBadge>
                                    </div>
                                    <p className="mt-3 text-xs leading-6 text-app-text-soft">{accountRow.details.join(" / ") || "暂无额外说明"}</p>
                                    {accountRow.topReason ? <p className="mt-2 text-xs text-app-danger">主要原因：{accountRow.topReason}</p> : null}
                                    <button type="button" onClick={() => void fetchAiSummary(aiKey, row.actionText, accountRow.details.join(" / ") || row.details.join(" / "), accountRow.topReason)} className="mt-3 text-xs text-app-accent hover:text-app-text-strong">AI 总结</button>
                                    {aiSummaryMap[aiKey] ? <p className="mt-2 text-xs text-app-text-soft">{aiSummaryMap[aiKey].summary}</p> : null}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      ) : null,
                    ];
                  })}
                </tbody>
              </table>
            </TableShell>
          )
        ) : filteredLogs.length === 0 ? (
          <div className="mt-5"><EmptyState title="当前筛选下暂无日志" description="调整筛选条件后再试。" /></div>
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[1280px]">
              <thead><tr>{isAdmin ? <th>用户</th> : null}<th>动作</th><th>账号</th><th>结果</th><th>阶段</th><th>详情</th><th>时间</th></tr></thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const summaryKey = `${log.id}:detail`;
                  return (
                    <tr key={log.id}>
                      {isAdmin ? <td>{users.find((user) => user.id === log.account?.ownerUserId)?.username || log.account?.ownerUserId || "-"}</td> : null}
                      <td className="font-medium text-app-text-strong">{getActionText(log)}</td>
                      <td>{log.account?.nickname || "系统"}</td>
                      <td><StatusBadge tone={getOutcomeMeta(log).tone}>{getOutcomeMeta(log).label}</StatusBadge></td>
                      <td>{getStageText(getLogStage(log))}</td>
                      <td className="max-w-[360px] text-xs text-app-text-soft">{getDetailText(log)} {aiSummaryMap[summaryKey] ? ` | ${aiSummaryMap[summaryKey].summary}` : ""}<button type="button" onClick={() => void fetchAiSummary(summaryKey, getActionText(log), getDetailText(log), log.errorMessage)} className="ml-2 text-xs text-app-accent hover:text-app-text-strong">AI</button></td>
                      <td>{formatDateTime(log.executedAt)}</td>
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
