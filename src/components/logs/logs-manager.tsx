"use client";

import type { ExecutionLog, WeiboAccount } from "@/generated/prisma/client";
import { getActionTypeText } from "@/lib/display-text";
import { useState } from "react";

type LogWithRelations = ExecutionLog & {
  account: WeiboAccount | null;
};

type UserOption = {
  id: string;
  username: string;
};

type LogStage = "UNKNOWN" | "PRECHECK_BLOCKED" | "PRECHECK_PASSED" | "ACTION_PENDING";

type ScheduleDecision = {
  taskType?: string;
  baseTier?: string;
  effectiveTier?: string;
  delayMs?: number;
  reasons?: string[];
};

type LogCategory = "PLAN" | "QUEUE" | "EXECUTION" | "RISK" | "SYSTEM";
type LogsViewMode = "SUMMARY" | "DETAIL";

type LogSummaryRow = {
  id: string;
  dateText: string;
  userText: string;
  category: LogCategory;
  actionText: string;
  total: number;
  successCount: number;
  failedCount: number;
  blockedCount: number;
  accountCount: number;
  latestExecutedAt: string;
  sampleDetails: string[];
  accountRows: Array<{
    accountId: string;
    accountText: string;
    successCount: number;
    failedCount: number;
    blockedCount: number;
    latestExecutedAt: string;
    sampleDetails: string[];
  }>;
};

function getLogCategory(log: LogWithRelations): LogCategory {
  if (log.actionType.includes("SCHEDULED") || log.actionType.includes("入队")) {
    return "QUEUE";
  }

  if (log.actionType.includes("RISK") || log.actionType.includes("CIRCUIT")) {
    return "RISK";
  }

  if (log.actionType.includes("PLAN") || log.actionType.includes("FIRST_COMMENT")) {
    return "PLAN";
  }

  if (["CHECK_IN", "POST", "LIKE", "COMMENT"].includes(log.actionType)) {
    return "EXECUTION";
  }

  return "SYSTEM";
}

const categoryText: Record<LogCategory, string> = {
  PLAN: "计划",
  QUEUE: "调度",
  EXECUTION: "执行",
  RISK: "风控",
  SYSTEM: "系统",
};

function getBusinessActionText(log: LogWithRelations) {
  const payload = log.requestPayload && typeof log.requestPayload === "object" && !Array.isArray(log.requestPayload) ? (log.requestPayload as Record<string, unknown>) : null;

  switch (log.actionType) {
    case "PLAN_GENERATED":
      return "生成今日计划";
    case "PLAN_SCHEDULED":
      return "计划进入执行队列";
    case "AUTO_CHECKIN_DAILY_RUN":
      return "自动签到调度";
    case "AUTO_FIRST_COMMENT_DAILY_RUN":
      return "自动首评调度";
    case "FIRST_COMMENT_EXECUTE_FAILED":
      return "首评执行";
    case "FIRST_COMMENT_EXECUTE_SUCCESS":
      return "首评执行";
    case "CHECK_IN":
      return "签到执行";
    case "POST":
      return "转发执行";
    case "LIKE":
      return "点赞执行";
    case "COMMENT":
      return "回复执行";
    case "INTERACTION_SCHEDULED":
      return "互动任务进入执行队列";
    case "INTERACTION_EXECUTE_BLOCKED":
    case "INTERACTION_EXECUTE_PRECHECKED":
      return "互动任务执行";
    case "ACTION_JOB_SCHEDULED":
      return payload?.jobType === "REPOST_ROTATION" ? "轮转任务进入执行队列" : "控评任务进入执行队列";
    default:
      return getActionTypeText(log.actionType, log.requestPayload);
  }
}

function getBusinessResultText(log: LogWithRelations) {
  const category = getLogCategory(log);
  const payload = log.requestPayload && typeof log.requestPayload === "object" && !Array.isArray(log.requestPayload) ? (log.requestPayload as Record<string, unknown>) : null;

  if (category === "QUEUE") {
    return log.success ? "已入队" : "入队失败";
  }

  if (log.actionType === "PLAN_GENERATED") {
    return log.success ? "已生成" : "生成失败";
  }

  if (log.actionType === "FIRST_COMMENT_EXECUTE_SUCCESS") {
    return "首评成功";
  }

  if (log.actionType === "FIRST_COMMENT_EXECUTE_FAILED") {
    return "首评失败";
  }

  if (log.actionType === "INTERACTION_EXECUTE_BLOCKED") {
    return "互动任务拦截";
  }

  if (log.actionType === "INTERACTION_EXECUTE_PRECHECKED") {
    const actionType = typeof payload?.actionType === "string" ? payload.actionType : null;
    if (actionType === "COMMENT") {
      return log.success ? "回复成功" : "回复失败";
    }
    if (actionType === "LIKE") {
      return log.success ? "点赞成功" : "点赞失败";
    }
    if (actionType === "POST") {
      return log.success ? "转发成功" : "转发失败";
    }
  }

  if (getLogStage(log) === "PRECHECK_BLOCKED") {
    return "预检拦截";
  }

  return log.success ? "执行成功" : "执行失败";
}

function getBusinessDetailText(log: LogWithRelations) {
  const payload = log.requestPayload && typeof log.requestPayload === "object" && !Array.isArray(log.requestPayload) ? (log.requestPayload as Record<string, unknown>) : null;
  const responsePayload = log.responsePayload && typeof log.responsePayload === "object" && !Array.isArray(log.responsePayload) ? (log.responsePayload as Record<string, unknown>) : null;
  const targetUrl = payload && typeof payload.targetUrl === "string" ? payload.targetUrl : null;
  const stage = getLogStage(log);

  if (log.actionType === "PLAN_GENERATED") {
    const date = payload && typeof payload.date === "string" ? payload.date : "未知日期";
    const createdCount = responsePayload && typeof responsePayload.createdCount === "number" ? responsePayload.createdCount : responsePayload && typeof responsePayload.count === "number" ? responsePayload.count : null;
    const existingCount = responsePayload && typeof responsePayload.existingCount === "number" ? responsePayload.existingCount : null;

    if (createdCount !== null || existingCount !== null) {
      return `日期 ${date}，新生成 ${createdCount ?? 0} 条，已存在 ${existingCount ?? 0} 条。`;
    }

    return `日期 ${date}，系统已为该账号生成计划。`;
  }

  if (log.actionType === "PLAN_SCHEDULED") {
    const date = payload && typeof payload.date === "string" ? payload.date : "未知日期";
    const queuedCount = responsePayload && typeof responsePayload.queuedCount === "number" ? responsePayload.queuedCount : null;
    return `日期 ${date}，已入队 ${queuedCount ?? 0} 条待执行计划。`;
  }

  if (log.actionType === "AUTO_CHECKIN_DAILY_RUN") {
    const date = payload && typeof payload.date === "string" ? payload.date : "未知日期";
    const total = responsePayload && typeof responsePayload.total === "number" ? responsePayload.total : null;
    const successCount = responsePayload && typeof responsePayload.success === "number" ? responsePayload.success : null;
    const failedCount = responsePayload && typeof responsePayload.failed === "number" ? responsePayload.failed : null;
    return `日期 ${date}，共处理 ${total ?? 0} 条签到计划，成功 ${successCount ?? 0} 条，失败 ${failedCount ?? 0} 条。`;
  }

  if (log.actionType === "AUTO_FIRST_COMMENT_DAILY_RUN") {
    const date = payload && typeof payload.date === "string" ? payload.date : "未知日期";
    return `日期 ${date}，自动首评调度已触发。`;
  }

  if (log.actionType === "ACTION_JOB_SCHEDULED") {
    const jobType = payload && typeof payload.jobType === "string" ? payload.jobType : "COMMENT_LIKE_BATCH";
    const queueDepth = payload && typeof payload.queueDepth === "number" ? payload.queueDepth : null;
    const concurrency = payload && typeof payload.userConcurrency === "number" ? payload.userConcurrency : null;
    const jobText = jobType === "REPOST_ROTATION" ? "轮转" : "控评";
    return `${jobText}批量任务已进入队列${queueDepth !== null ? `，当前队列深度 ${queueDepth}` : ""}${concurrency !== null ? `，用户并发 ${concurrency}` : ""}。`;
  }

  if (log.actionType === "INTERACTION_EXECUTE_BLOCKED" || log.actionType === "INTERACTION_EXECUTE_PRECHECKED") {
    const actionType = payload && typeof payload.actionType === "string" ? payload.actionType : "COMMENT";
    const targetUrl = payload && typeof payload.targetUrl === "string" ? payload.targetUrl : null;
    const actionText = actionType === "LIKE" ? "点赞" : actionType === "POST" ? "转发" : actionType === "CHECK_IN" ? "签到" : "回复";
    return `${actionText}互动任务${targetUrl ? `，目标 ${targetUrl}` : ""}${getLogStage(log) === "PRECHECK_BLOCKED" ? "，执行前被拦截。" : "。"}`;
  }

  if (log.errorMessage) {
    return log.errorMessage;
  }

  if (stage === "PRECHECK_BLOCKED") {
    return "执行前校验未通过，任务未真正发起。";
  }

  if (targetUrl) {
    return targetUrl;
  }

  if (getLogCategory(log) === "QUEUE") {
    return "任务已进入排队执行阶段，尚不代表已执行完成。";
  }

  return getResponseSummary(log.responsePayload);
}

function getSummaryKey(log: LogWithRelations, users: UserOption[], isAdmin: boolean) {
  const dateText = new Date(log.executedAt).toLocaleDateString("zh-CN");
  const userText = isAdmin ? users.find((user) => user.id === log.account?.ownerUserId)?.username || log.account?.ownerUserId || "-" : "当前用户";
  return {
    key: [dateText, userText, getLogCategory(log), getBusinessActionText(log)].join("::"),
    dateText,
    userText,
  };
}

function buildLogSummaries(logs: LogWithRelations[], users: UserOption[], isAdmin: boolean) {
  const map = new Map<
    string,
    LogSummaryRow & {
      accountIds: Set<string>;
      accountMap: Map<
        string,
        {
          accountId: string;
          accountText: string;
          successCount: number;
          failedCount: number;
          blockedCount: number;
          latestExecutedAt: string;
          sampleDetails: string[];
        }
      >;
    }
  >();

  for (const log of logs) {
    const summaryKey = getSummaryKey(log, users, isAdmin);
    const category = getLogCategory(log);
    const actionText = getBusinessActionText(log);
    const detailText = getBusinessDetailText(log);
    const row = map.get(summaryKey.key);

    if (!row) {
      map.set(summaryKey.key, {
        id: summaryKey.key,
        dateText: summaryKey.dateText,
        userText: summaryKey.userText,
        category,
        actionText,
        total: 1,
        successCount: log.success ? 1 : 0,
        failedCount: log.success ? 0 : 1,
        blockedCount: getLogStage(log) === "PRECHECK_BLOCKED" ? 1 : 0,
        accountCount: log.account?.id ? 1 : 0,
        latestExecutedAt: log.executedAt.toISOString(),
        sampleDetails: detailText && detailText !== "-" ? [detailText] : [],
        accountRows: [],
        accountIds: new Set(log.account?.id ? [log.account.id] : []),
        accountMap: new Map(
          log.account?.id
            ? [
                [
                  log.account.id,
                  {
                    accountId: log.account.id,
                    accountText: log.account.nickname || log.account.id,
                    successCount: log.success ? 1 : 0,
                    failedCount: log.success ? 0 : 1,
                    blockedCount: getLogStage(log) === "PRECHECK_BLOCKED" ? 1 : 0,
                    latestExecutedAt: log.executedAt.toISOString(),
                    sampleDetails: detailText && detailText !== "-" ? [detailText] : [],
                  },
                ],
              ]
            : [],
        ),
      });
      continue;
    }

    row.total += 1;
    row.successCount += log.success ? 1 : 0;
    row.failedCount += log.success ? 0 : 1;
    row.blockedCount += getLogStage(log) === "PRECHECK_BLOCKED" ? 1 : 0;
    if (log.account?.id) {
      row.accountIds.add(log.account.id);
      row.accountCount = row.accountIds.size;
    }
    if (detailText && detailText !== "-" && !row.sampleDetails.includes(detailText) && row.sampleDetails.length < 3) {
      row.sampleDetails.push(detailText);
    }
    if (new Date(log.executedAt).getTime() > new Date(row.latestExecutedAt).getTime()) {
      row.latestExecutedAt = log.executedAt.toISOString();
    }

    if (log.account?.id) {
      const accountRow = row.accountMap.get(log.account.id);

      if (!accountRow) {
        row.accountMap.set(log.account.id, {
          accountId: log.account.id,
          accountText: log.account.nickname || log.account.id,
          successCount: log.success ? 1 : 0,
          failedCount: log.success ? 0 : 1,
          blockedCount: getLogStage(log) === "PRECHECK_BLOCKED" ? 1 : 0,
          latestExecutedAt: log.executedAt.toISOString(),
          sampleDetails: detailText && detailText !== "-" ? [detailText] : [],
        });
      } else {
        accountRow.successCount += log.success ? 1 : 0;
        accountRow.failedCount += log.success ? 0 : 1;
        accountRow.blockedCount += getLogStage(log) === "PRECHECK_BLOCKED" ? 1 : 0;
        if (detailText && detailText !== "-" && !accountRow.sampleDetails.includes(detailText) && accountRow.sampleDetails.length < 2) {
          accountRow.sampleDetails.push(detailText);
        }
        if (new Date(log.executedAt).getTime() > new Date(accountRow.latestExecutedAt).getTime()) {
          accountRow.latestExecutedAt = log.executedAt.toISOString();
        }
      }
    }
  }

  return Array.from(map.values())
    .map((row) => {
      const { accountIds, accountMap, ...item } = row;
      void accountIds;
      return {
        ...item,
        accountRows: Array.from(accountMap.values()).sort((a, b) => new Date(b.latestExecutedAt).getTime() - new Date(a.latestExecutedAt).getTime()),
      };
    })
    .sort((a, b) => new Date(b.latestExecutedAt).getTime() - new Date(a.latestExecutedAt).getTime());
}

function getSummarySuccessText(row: LogSummaryRow) {
  if (row.failedCount === 0) {
    return `成功 ${row.successCount}`;
  }

  if (row.successCount === 0) {
    return `失败 ${row.failedCount}`;
  }

  return `成功 ${row.successCount} / 失败 ${row.failedCount}`;
}

function readStageFromPayload(payload: unknown): LogStage {
  if (!payload || typeof payload !== "object") {
    return "UNKNOWN";
  }

  const record = payload as Record<string, unknown>;
  const stage = record.stage;

  if (stage === "PRECHECK_BLOCKED" || stage === "PRECHECK_PASSED" || stage === "ACTION_PENDING") {
    return stage;
  }

  return "UNKNOWN";
}

function getLogStage(log: LogWithRelations): LogStage {
  const requestStage = readStageFromPayload(log.requestPayload);

  if (requestStage !== "UNKNOWN") {
    return requestStage;
  }

  const responseStage = readStageFromPayload(log.responsePayload);

  if (responseStage !== "UNKNOWN") {
    return responseStage;
  }

  return "UNKNOWN";
}

const stageText: Record<LogStage, string> = {
  UNKNOWN: "未标记",
  PRECHECK_BLOCKED: "预检拦截",
  PRECHECK_PASSED: "预检通过",
  ACTION_PENDING: "动作已发起",
};

function getResponseSummary(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "-";
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.summary === "string") {
    return record.summary;
  }

  if (typeof record.message === "string") {
    return record.message;
  }

  if (typeof record.responseSummary === "string") {
    return record.responseSummary;
  }

  if (record.probe && typeof record.probe === "object") {
    const probe = record.probe as Record<string, unknown>;

    if (typeof probe.summary === "string") {
      return probe.summary;
    }
  }

  return "-";
}

function readScheduleDecision(payload: unknown): ScheduleDecision | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const scheduleDecision = record.scheduleDecision;

  if (!scheduleDecision || typeof scheduleDecision !== "object" || Array.isArray(scheduleDecision)) {
    return null;
  }

  return scheduleDecision as ScheduleDecision;
}

function getScheduleDecision(log: LogWithRelations) {
  return readScheduleDecision(log.requestPayload) || readScheduleDecision(log.responsePayload);
}

function formatDelay(delayMs?: number) {
  if (!delayMs || delayMs <= 0) {
    return "无延后";
  }

  if (delayMs < 60_000) {
    return `${Math.ceil(delayMs / 1000)} 秒`;
  }

  return `${Math.ceil(delayMs / 60_000)} 分钟`;
}

function getScheduleSummary(log: LogWithRelations) {
  const decision = getScheduleDecision(log);

  if (!decision) {
    return "-";
  }

  const tierChanged = decision.baseTier && decision.effectiveTier && decision.baseTier !== decision.effectiveTier;
  const reasonText = decision.reasons && decision.reasons.length > 0 ? decision.reasons.join(" / ") : "正常调度";

  return `${decision.taskType || "任务"} | ${decision.baseTier || "-"} -> ${decision.effectiveTier || decision.baseTier || "-"} | ${formatDelay(decision.delayMs)} | ${tierChanged ? "已降级" : "未降级"} | ${reasonText}`;
}

export function LogsManager({ initialLogs, users, isAdmin }: { initialLogs: LogWithRelations[]; users: UserOption[]; isAdmin: boolean }) {
  const [viewMode, setViewMode] = useState<LogsViewMode>("SUMMARY");
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [resultFilter, setResultFilter] = useState<"ALL" | "SUCCESS" | "FAILED">("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState<"ALL" | LogStage>("ALL");
  const [userFilter, setUserFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const actionOptions = Array.from(new Set(initialLogs.map((log) => log.actionType)));
  const filteredLogs = initialLogs.filter((log) => {
    const matchesKeyword =
      keyword.trim() === "" ||
      log.actionType.toLowerCase().includes(keyword.trim().toLowerCase()) ||
      getActionTypeText(log.actionType, log.requestPayload).toLowerCase().includes(keyword.trim().toLowerCase()) ||
      (log.account?.nickname || "").toLowerCase().includes(keyword.trim().toLowerCase()) ||
      (log.errorMessage || "").toLowerCase().includes(keyword.trim().toLowerCase());
    const matchesResult =
      resultFilter === "ALL" || (resultFilter === "SUCCESS" ? log.success : !log.success);
    const matchesAction = actionFilter === "ALL" || log.actionType === actionFilter;
    const matchesStage = stageFilter === "ALL" || getLogStage(log) === stageFilter;
    const matchesUser = !isAdmin || userFilter === "ALL" || log.account?.ownerUserId === userFilter;
    const logDate = new Date(log.executedAt);
    const matchesStartDate = startDate === "" || logDate >= new Date(`${startDate}T00:00:00`);
    const matchesEndDate = endDate === "" || logDate <= new Date(`${endDate}T23:59:59`);

    return matchesKeyword && matchesResult && matchesAction && matchesStage && matchesUser && matchesStartDate && matchesEndDate;
  });
  const summaryRows = buildLogSummaries(filteredLogs, users, isAdmin);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">执行日志</h2>
        <p className="mt-1 text-sm text-slate-500">查看最近的计划生成、任务变更和互动任务记录。</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setViewMode("SUMMARY")}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${viewMode === "SUMMARY" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            汇总视图
          </button>
          <button
            type="button"
            onClick={() => setViewMode("DETAIL")}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${viewMode === "DETAIL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            明细视图
          </button>
        </div>
        <div className={`grid gap-3 ${isAdmin ? "md:grid-cols-7" : "md:grid-cols-6"}`}>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索动作、账号、错误信息"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
          />
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="ALL">全部动作</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {getActionTypeText(action)}
              </option>
            ))}
          </select>
          <select
            value={resultFilter}
            onChange={(event) => setResultFilter(event.target.value as "ALL" | "SUCCESS" | "FAILED")}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="ALL">全部结果</option>
            <option value="SUCCESS">仅成功</option>
              <option value="FAILED">仅失败</option>
            </select>
          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value as "ALL" | LogStage)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="ALL">全部阶段</option>
            <option value="PRECHECK_BLOCKED">预检拦截</option>
            <option value="PRECHECK_PASSED">预检通过</option>
            <option value="ACTION_PENDING">动作已发起</option>
            <option value="UNKNOWN">未标记</option>
          </select>
          {isAdmin ? (
            <select
              value={userFilter}
              onChange={(event) => setUserFilter(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="ALL">全部用户</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
          ) : null}
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
          />
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {viewMode === "SUMMARY" ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">日期</th>
                {isAdmin ? <th className="px-6 py-3 font-medium">用户</th> : null}
                <th className="px-6 py-3 font-medium">分类</th>
                <th className="px-6 py-3 font-medium">动作</th>
                <th className="px-6 py-3 font-medium">账号数</th>
                <th className="px-6 py-3 font-medium">成功/失败</th>
                <th className="px-6 py-3 font-medium">预检拦截</th>
                <th className="px-6 py-3 font-medium">说明</th>
                <th className="px-6 py-3 font-medium">最近时间</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-6 py-8 text-slate-500">
                    当前筛选条件下暂无汇总数据。
                  </td>
                </tr>
              ) : (
                summaryRows.flatMap((row) => {
                  const expanded = expandedSummaryId === row.id;

                  return [
                    <tr key={row.id} className="border-t border-slate-200 align-top">
                      <td className="px-6 py-4">{row.dateText}</td>
                      {isAdmin ? <td className="px-6 py-4">{row.userText}</td> : null}
                      <td className="px-6 py-4">{categoryText[row.category]}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => setExpandedSummaryId(expanded ? null : row.id)} className="text-sky-700 hover:text-sky-800">
                            {expanded ? "收起" : "展开"}
                          </button>
                          <span>{row.actionText}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">{row.accountCount || "-"}</td>
                      <td className="px-6 py-4">{getSummarySuccessText(row)}</td>
                      <td className="px-6 py-4">{row.blockedCount}</td>
                      <td className="max-w-md px-6 py-4 text-slate-600">{row.sampleDetails.join(" / ") || "-"}</td>
                      <td className="px-6 py-4">{new Date(row.latestExecutedAt).toLocaleString("zh-CN")}</td>
                    </tr>,
                    expanded ? (
                      <tr key={`${row.id}-accounts`} className="border-t border-slate-100 bg-slate-50">
                        <td colSpan={isAdmin ? 9 : 8} className="px-6 py-4">
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {row.accountRows.map((accountRow) => (
                              <div key={accountRow.accountId} className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-medium">{accountRow.accountText}</span>
                                  <span className="text-xs text-slate-500">{new Date(accountRow.latestExecutedAt).toLocaleString("zh-CN")}</span>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">成功 {accountRow.successCount} / 失败 {accountRow.failedCount} / 拦截 {accountRow.blockedCount}</p>
                                <p className="mt-2 text-xs text-slate-600">{accountRow.sampleDetails.join(" / ") || "暂无额外说明"}</p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ) : null,
                  ];
                })
              )}
            </tbody>
          </table>
        ) : (
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {isAdmin ? <th className="px-6 py-3 font-medium">用户</th> : null}
              <th className="px-6 py-3 font-medium">分类</th>
              <th className="px-6 py-3 font-medium">动作</th>
              <th className="px-6 py-3 font-medium">账号</th>
              <th className="px-6 py-3 font-medium">结果</th>
              <th className="px-6 py-3 font-medium">阶段</th>
              <th className="px-6 py-3 font-medium">调度说明</th>
              <th className="px-6 py-3 font-medium">详情</th>
              <th className="px-6 py-3 font-medium">时间</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-6 py-8 text-slate-500">
                    当前筛选条件下暂无日志数据。
                  </td>
                </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="border-t border-slate-200">
                  {isAdmin ? <td className="px-6 py-4">{users.find((user) => user.id === log.account?.ownerUserId)?.username || log.account?.ownerUserId || "-"}</td> : null}
                  <td className="px-6 py-4">{categoryText[getLogCategory(log)]}</td>
                  <td className="px-6 py-4">{getBusinessActionText(log)}</td>
                  <td className="px-6 py-4">{log.account?.nickname || "-"}</td>
                  <td className="px-6 py-4">{getBusinessResultText(log)}</td>
                  <td className="px-6 py-4">{stageText[getLogStage(log)]}</td>
                  <td className="max-w-md px-6 py-4 text-slate-600">{getScheduleSummary(log)}</td>
                  <td className="max-w-sm px-6 py-4 text-slate-600">{getBusinessDetailText(log)}</td>
                  <td className="px-6 py-4">{new Date(log.executedAt).toLocaleString("zh-CN")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        )}
      </section>
    </div>
  );
}
