"use client";

import type { CopywritingTemplate, DailyPlan, SuperTopic, WeiboAccount } from "@/generated/prisma/client";
import { canManageBusinessData, canReviewAndExecuteTasks } from "@/lib/permission-rules";
import type { AppRole } from "@/lib/permission-rules";
import { FormEvent, useState } from "react";

type PlanWithRelations = DailyPlan & {
  account: WeiboAccount;
  content: CopywritingTemplate | null;
  task: {
    superTopic: SuperTopic;
  } | null;
};

type PlanStatus = "PENDING" | "READY" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";

const statusText: Record<PlanStatus, string> = {
  PENDING: "待审核",
  READY: "已确认",
  RUNNING: "执行中",
  SUCCESS: "成功",
  FAILED: "失败",
  CANCELLED: "已取消",
};

function toLocalDateTimeValue(value: string | Date) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function PlansManager({
  initialPlans,
  initialDate,
  contents,
  currentUserRole,
}: {
  initialPlans: PlanWithRelations[];
  initialDate: string;
  contents: CopywritingTemplate[];
  currentUserRole: AppRole;
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [date, setDate] = useState(initialDate);
  const [statusFilter, setStatusFilter] = useState<PlanStatus | "ALL">("ALL");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [topicFilter, setTopicFilter] = useState("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScheduledTime, setEditScheduledTime] = useState("");
  const [editContentId, setEditContentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = canManageBusinessData(currentUserRole);
  const canExecute = canReviewAndExecuteTasks(currentUserRole);

  const accountOptions = Array.from(new Set(plans.map((plan) => plan.account.nickname)));
  const topicOptions = Array.from(new Set(plans.map((plan) => plan.task?.superTopic.name).filter(Boolean))) as string[];
  const filteredPlans = plans.filter((plan) => {
    const matchesStatus = statusFilter === "ALL" || plan.status === statusFilter;
    const matchesAccount = accountFilter === "ALL" || plan.account.nickname === accountFilter;
    const matchesTopic = topicFilter === "ALL" || plan.task?.superTopic.name === topicFilter;

    return matchesStatus && matchesAccount && matchesTopic;
  });

  async function loadPlansByDate() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/plans?date=${date}`, { cache: "no-store" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "获取计划失败");
      }

      setPlans(result.data);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取计划失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "生成计划失败");
      }

      setPlans(result.data);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成计划失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id: string, status: PlanStatus) {
    try {
      setError(null);

      const response = await fetch(`/api/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "更新状态失败");
      }

      setPlans((current) => current.map((item) => (item.id === id ? result.data : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新状态失败");
    }
  }

  async function handleExecute(id: string) {
    try {
      setError(null);

      const response = await fetch(`/api/plans/${id}/execute`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "执行计划失败");
      }

      setPlans((current) => current.map((item) => (item.id === id ? result.data : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "执行计划失败");
    }
  }

  async function handleApprove(id: string) {
    try {
      setError(null);

      const response = await fetch(`/api/plans/${id}/approve`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "确认计划失败");
      }

      setPlans((current) => current.map((item) => (item.id === id ? result.data : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "确认计划失败");
    }
  }

  async function handleReject(id: string) {
    try {
      setError(null);

      const response = await fetch(`/api/plans/${id}/reject`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "驳回计划失败");
      }

      setPlans((current) => current.map((item) => (item.id === id ? result.data : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "驳回计划失败");
    }
  }

  function startEdit(plan: PlanWithRelations) {
    setEditingId(plan.id);
    setEditScheduledTime(toLocalDateTimeValue(plan.scheduledTime));
    setEditContentId(plan.contentId || "");
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditScheduledTime("");
    setEditContentId("");
  }

  async function saveEdit(id: string) {
    try {
      setError(null);

      const response = await fetch(`/api/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledTime: new Date(editScheduledTime).toISOString(),
          contentId: editContentId || null,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "更新计划失败");
      }

      setPlans((current) => current.map((item) => (item.id === id ? result.data : item)));
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新计划失败");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">每日计划</h2>
        <p className="mt-1 text-sm text-slate-500">按任务配置生成每日签到和发帖计划，并跟踪执行状态。</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between" onSubmit={handleGenerate}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="text-sm font-medium text-slate-700">计划日期</label>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as PlanStatus | "ALL")}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="ALL">全部状态</option>
              <option value="PENDING">待执行</option>
              <option value="READY">待确认</option>
              <option value="RUNNING">执行中</option>
              <option value="SUCCESS">成功</option>
              <option value="FAILED">失败</option>
              <option value="CANCELLED">已取消</option>
            </select>
            <select
              value={accountFilter}
              onChange={(event) => setAccountFilter(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="ALL">全部账号</option>
              {accountOptions.map((account) => (
                <option key={account} value={account}>
                  {account}
                </option>
              ))}
            </select>
            <select
              value={topicFilter}
              onChange={(event) => setTopicFilter(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="ALL">全部超话</option>
              {topicOptions.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            {error ? <p className="text-sm text-rose-600">{error}</p> : <div />}
            <button
              type="button"
              onClick={loadPlansByDate}
              disabled={loading}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "读取中..." : "查看当日计划"}
            </button>
            {canManage ? (
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "生成中..." : "生成当日计划"}
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">时间</th>
              <th className="px-6 py-3 font-medium">账号</th>
              <th className="px-6 py-3 font-medium">超话</th>
              <th className="px-6 py-3 font-medium">类型</th>
              <th className="px-6 py-3 font-medium">文案</th>
              <th className="px-6 py-3 font-medium">状态</th>
              <th className="px-6 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlans.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-slate-500">
                  当前日期暂无计划，请先生成。
                </td>
              </tr>
            ) : (
              filteredPlans.map((plan) => {
                const isEditing = editingId === plan.id;

                return (
                  <tr key={plan.id} className="border-t border-slate-200 align-top">
                    <td className="px-6 py-4">
                       {isEditing && canManage ? (
                         <input
                           type="datetime-local"
                           value={editScheduledTime}
                          onChange={(event) => setEditScheduledTime(event.target.value)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                        />
                      ) : (
                        new Date(plan.scheduledTime).toLocaleString("zh-CN")
                      )}
                    </td>
                    <td className="px-6 py-4">{plan.account.nickname}</td>
                    <td className="px-6 py-4">{plan.task?.superTopic.name || "-"}</td>
                    <td className="px-6 py-4">{plan.planType === "CHECK_IN" ? "签到" : plan.planType === "POST" ? "发帖" : "点赞"}</td>
                    <td className="max-w-sm px-6 py-4 text-slate-600">
                       {isEditing && canManage ? (
                         <select
                           value={editContentId}
                           onChange={(event) => setEditContentId(event.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                        >
                          <option value="">不绑定文案</option>
                          {contents.map((content) => (
                            <option key={content.id} value={content.id}>
                              {content.title}
                            </option>
                          ))}
                        </select>
                      ) : (
                        plan.content?.content || "-"
                      )}
                    </td>
                    <td className="px-6 py-4">{statusText[plan.status]}</td>
                    <td className="px-6 py-4">
                       {isEditing && canManage ? (
                         <div className="flex flex-wrap gap-2">
                           <button onClick={() => saveEdit(plan.id)} className="text-emerald-600 hover:text-emerald-700">
                             保存
                          </button>
                          <button onClick={cancelEdit} className="text-slate-600 hover:text-slate-700">
                            取消
                          </button>
                        </div>
                       ) : canManage || canExecute ? (
                         <div className="flex flex-wrap gap-2">
                           {canManage ? (
                             <button onClick={() => startEdit(plan)} className="text-sky-600 hover:text-sky-700">
                               编辑
                             </button>
                           ) : null}
                           {canExecute ? (
                             <button onClick={() => handleExecute(plan.id)} className="text-violet-600 hover:text-violet-700">
                               执行预检
                             </button>
                           ) : null}
                           {canExecute && plan.status === "PENDING" ? (
                             <>
                               <button onClick={() => handleApprove(plan.id)} className="text-sky-600 hover:text-sky-700">
                                 确认
                              </button>
                              <button onClick={() => handleReject(plan.id)} className="text-rose-600 hover:text-rose-700">
                                驳回
                              </button>
                            </>
                          ) : null}
                           {canExecute ? (
                             <>
                               <button onClick={() => handleStatusChange(plan.id, "SUCCESS")} className="text-emerald-600 hover:text-emerald-700">
                                 成功
                               </button>
                               <button onClick={() => handleStatusChange(plan.id, "FAILED")} className="text-amber-600 hover:text-amber-700">
                                 失败
                               </button>
                               <button onClick={() => handleStatusChange(plan.id, "CANCELLED")} className="text-rose-600 hover:text-rose-700">
                                 取消
                               </button>
                             </>
                           ) : null}
                         </div>
                       ) : <span className="text-slate-400">只读</span>}
                     </td>
                   </tr>
                 );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
