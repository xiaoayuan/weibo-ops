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
              <th className="px-6 py-3 font-medium">动作</th>
              <th className="px-6 py-3 font-medium">账号</th>
              <th className="px-6 py-3 font-medium">结果</th>
              <th className="px-6 py-3 font-medium">阶段</th>
              <th className="px-6 py-3 font-medium">响应摘要</th>
              <th className="px-6 py-3 font-medium">错误信息</th>
              <th className="px-6 py-3 font-medium">时间</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="px-6 py-8 text-slate-500">
                  当前筛选条件下暂无日志数据。
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="border-t border-slate-200">
                  {isAdmin ? <td className="px-6 py-4">{users.find((user) => user.id === log.account?.ownerUserId)?.username || log.account?.ownerUserId || "-"}</td> : null}
                  <td className="px-6 py-4">{getActionTypeText(log.actionType, log.requestPayload)}</td>
                  <td className="px-6 py-4">{log.account?.nickname || "-"}</td>
                  <td className="px-6 py-4">{log.success ? "成功" : "失败"}</td>
                  <td className="px-6 py-4">{stageText[getLogStage(log)]}</td>
                  <td className="max-w-sm px-6 py-4 text-slate-600">{getResponseSummary(log.responsePayload)}</td>
                  <td className="px-6 py-4 text-slate-600">{log.errorMessage || "-"}</td>
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
