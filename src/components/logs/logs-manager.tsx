"use client";

import type { ExecutionLog, WeiboAccount } from "@/generated/prisma/client";
import { useState } from "react";

type LogWithRelations = ExecutionLog & {
  account: WeiboAccount | null;
};

export function LogsManager({ initialLogs }: { initialLogs: LogWithRelations[] }) {
  const [keyword, setKeyword] = useState("");
  const [resultFilter, setResultFilter] = useState<"ALL" | "SUCCESS" | "FAILED">("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const actionOptions = Array.from(new Set(initialLogs.map((log) => log.actionType)));
  const filteredLogs = initialLogs.filter((log) => {
    const matchesKeyword =
      keyword.trim() === "" ||
      log.actionType.toLowerCase().includes(keyword.trim().toLowerCase()) ||
      (log.account?.nickname || "").toLowerCase().includes(keyword.trim().toLowerCase()) ||
      (log.errorMessage || "").toLowerCase().includes(keyword.trim().toLowerCase());
    const matchesResult =
      resultFilter === "ALL" || (resultFilter === "SUCCESS" ? log.success : !log.success);
    const matchesAction = actionFilter === "ALL" || log.actionType === actionFilter;
    const logDate = new Date(log.executedAt);
    const matchesStartDate = startDate === "" || logDate >= new Date(`${startDate}T00:00:00`);
    const matchesEndDate = endDate === "" || logDate <= new Date(`${endDate}T23:59:59`);

    return matchesKeyword && matchesResult && matchesAction && matchesStartDate && matchesEndDate;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">执行日志</h2>
        <p className="mt-1 text-sm text-slate-500">查看最近的计划生成、任务变更和互动任务记录。</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
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
                {action}
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
              <th className="px-6 py-3 font-medium">动作</th>
              <th className="px-6 py-3 font-medium">账号</th>
              <th className="px-6 py-3 font-medium">结果</th>
              <th className="px-6 py-3 font-medium">错误信息</th>
              <th className="px-6 py-3 font-medium">时间</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-slate-500">
                  当前筛选条件下暂无日志数据。
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="border-t border-slate-200">
                  <td className="px-6 py-4">{log.actionType}</td>
                  <td className="px-6 py-4">{log.account?.nickname || "-"}</td>
                  <td className="px-6 py-4">{log.success ? "成功" : "失败"}</td>
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
