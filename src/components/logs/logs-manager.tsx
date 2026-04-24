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
      return "批量任务进入执行队列";
    default:
      return getActionTypeText(log.actionType, log.requestPayload);
  }
}

function getBusinessResultText(log: LogWithRelations) {
  const category = getLogCategory(log);

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

  if (getLogStage(log) === "PRECHECK_BLOCKED") {
    return "预检拦截";
  }

  return log.success ? "执行成功" : "执行失败";
}

function getBusinessDetailText(log: LogWithRelations) {
  const payload = log.requestPayload && typeof log.requestPayload === "object" && !Array.isArray(log.requestPayload) ? (log.requestPayload as Record<string, unknown>) : null;
  const targetUrl = payload && typeof payload.targetUrl === "string" ? payload.targetUrl : null;
  const stage = getLogStage(log);

  if (log.errorMessage) {
    return log.errorMessage;
  }

  if (stage === "PRECHECK_BLOCKED") {
    return "执行前校验未通过，任务未真正发起。";
  }

  if (targetUrl) {
    return targetUrl;
  }

  if (log.actionType === "PLAN_GENERATED") {
    return "系统已为该账号生成计划。";
  }

  if (getLogCategory(log) === "QUEUE") {
    return "任务已进入排队执行阶段，尚不代表已执行完成。";
  }

  return getResponseSummary(log.responsePayload);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">执行日志</h2>
        <p className="mt-1 text-sm text-slate-500">查看最近的计划生成、任务变更和互动任务记录。</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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
      </section>
    </div>
  );
}
