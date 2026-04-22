"use client";

import type { CopywritingTemplate, DailyPlan, SuperTopic, WeiboAccount } from "@/generated/prisma/client";
import { getBusinessDateText } from "@/lib/business-date";
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

function getPlanTypeText(planType: DailyPlan["planType"]) {
  if (planType === "CHECK_IN") {
    return "签到";
  }

  if (planType === "FIRST_COMMENT") {
    return "首评";
  }

  if (planType === "POST") {
    return "转发";
  }

  return "点赞";
}

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
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScheduledTime, setEditScheduledTime] = useState("");
  const [editContentId, setEditContentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [batchExecuting, setBatchExecuting] = useState(false);
  const [batchStopping, setBatchStopping] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canManage = canManageBusinessData(currentUserRole);
  const canExecute = canReviewAndExecuteTasks(currentUserRole);
  const today = getBusinessDateText();
  const viewingHistory = date < today;
  const viewingFuture = date > today;

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
      setNotice(null);

      const response = await fetch(`/api/plans?date=${date}`, { cache: "no-store" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "获取计划失败");
      }

      setPlans(result.data);
      setEditingId(null);
      setSelectedPlanIds([]);
      setNotice(date === today ? "当前展示的是今天的计划。" : `当前展示的是 ${date} 的历史或预生成计划。`);
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
      setNotice(null);

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
      setSelectedPlanIds([]);
      setNotice(
        result.message ||
          (result.meta?.createdCount > 0
            ? `新增 ${result.meta.createdCount} 条计划，原有 ${result.meta.existingCount} 条。`
            : `当前日期已有 ${result.meta?.existingCount || 0} 条计划，本次未新增。`),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成计划失败");
    } finally {
      setLoading(false);
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

  async function handleStop(id: string) {
    if (!window.confirm("确认停止这条计划吗？")) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/plans/${id}/stop`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "停止计划失败");
      }

      setPlans((current) => current.map((item) => (item.id === id ? result.data : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "停止计划失败");
    }
  }

  function togglePlanSelection(id: string) {
    setSelectedPlanIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectAllFilteredPlans() {
    setSelectedPlanIds(filteredPlans.map((plan) => plan.id));
  }

  function clearSelection() {
    setSelectedPlanIds([]);
  }

  async function handleBatchExecute() {
    const selectedSet = new Set(selectedPlanIds);
    const baseCandidates = selectedPlanIds.length > 0 ? filteredPlans.filter((plan) => selectedSet.has(plan.id)) : filteredPlans;
    const candidates = baseCandidates.filter(
      (plan) => plan.status === "PENDING" || plan.status === "READY" || plan.status === "FAILED",
    );

    if (candidates.length === 0) {
      setError("当前筛选下没有可执行或可重试的计划");
      return;
    }

    if (!window.confirm(`确认批量执行当前筛选的 ${candidates.length} 条计划吗？`)) {
      return;
    }

    try {
      setBatchExecuting(true);
      setError(null);

      let failed = 0;

      for (const plan of candidates) {
        try {
          const response = await fetch(`/api/plans/${plan.id}/execute`, {
            method: "POST",
          });
          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.message || "执行计划失败");
          }

          setPlans((current) => current.map((item) => (item.id === plan.id ? result.data : item)));
        } catch {
          failed += 1;
        }
      }

      if (failed > 0) {
        setError(`批量执行完成，失败 ${failed} 条，请查看日志`);
      }
    } finally {
      setBatchExecuting(false);
    }
  }

  async function handleBatchStop() {
    const selectedSet = new Set(selectedPlanIds);
    const baseCandidates = selectedPlanIds.length > 0 ? filteredPlans.filter((plan) => selectedSet.has(plan.id)) : filteredPlans;
    const candidates = baseCandidates.filter((plan) => ["PENDING", "READY", "RUNNING"].includes(plan.status));

    if (candidates.length === 0) {
      setError("当前筛选下没有可停止的计划");
      return;
    }

    if (!window.confirm(`确认停止当前筛选的 ${candidates.length} 条计划吗？`)) {
      return;
    }

    try {
      setBatchStopping(true);
      setError(null);
      setNotice(null);

      let stopped = 0;
      let failed = 0;

      for (const plan of candidates) {
        try {
          const response = await fetch(`/api/plans/${plan.id}/stop`, {
            method: "POST",
          });
          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.message || "停止计划失败");
          }

          setPlans((current) => current.map((item) => (item.id === plan.id ? result.data : item)));
          stopped += 1;
        } catch {
          failed += 1;
        }
      }

      const summary = `批量停止完成：成功 ${stopped} 条${failed > 0 ? `，失败 ${failed} 条` : ""}`;

      if (failed > 0) {
        setError(summary);
      } else {
        setNotice(summary);
      }
    } finally {
      setBatchStopping(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确认删除这条计划吗？")) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/plans/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "删除计划失败");
      }

      setPlans((current) => current.filter((item) => item.id !== id));
      setSelectedPlanIds((current) => current.filter((planId) => planId !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除计划失败");
    }
  }

  async function handleBatchDelete() {
    const selectedSet = new Set(selectedPlanIds);
    const candidates = selectedPlanIds.length > 0 ? filteredPlans.filter((plan) => selectedSet.has(plan.id)) : filteredPlans;

    if (candidates.length === 0) {
      setError("当前筛选下没有可删除的计划");
      return;
    }

    if (!window.confirm(`确认删除 ${candidates.length} 条计划吗？该操作不可恢复。`)) {
      return;
    }

    try {
      setBatchDeleting(true);
      setError(null);

      let failed = 0;

      for (const plan of candidates) {
        try {
          const response = await fetch(`/api/plans/${plan.id}`, {
            method: "DELETE",
          });
          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.message || "删除计划失败");
          }

          setPlans((current) => current.filter((item) => item.id !== plan.id));
          setSelectedPlanIds((current) => current.filter((id) => id !== plan.id));
        } catch {
          failed += 1;
        }
      }

      if (failed > 0) {
        setError(`批量删除完成，失败 ${failed} 条，请重试`);
      }
    } finally {
      setBatchDeleting(false);
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

      const plan = plans.find((item) => item.id === id);

      if (!plan) {
        throw new Error("计划不存在");
      }

      const payload: {
        scheduledTime: string;
        contentId?: string | null;
      } = {
        scheduledTime: new Date(editScheduledTime).toISOString(),
      };

      if (plan.planType !== "FIRST_COMMENT") {
        payload.contentId = editContentId || null;
      }

      const response = await fetch(`/api/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        <p className="mt-1 text-sm text-slate-500">按任务配置生成每日签到计划，并跟踪执行状态。</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p>当前查看日期：{date}</p>
        <p className="mt-1">
          {viewingHistory
            ? "你当前查看的是历史日期。历史计划会保留用于追溯，但不会阻塞新一天生成。"
            : viewingFuture
              ? "你当前查看的是未来日期。可提前生成预排计划。"
              : "你当前查看的是今天的业务日计划。跨天后请切换到新日期重新生成。"}
        </p>
        {notice ? <p className="mt-2 text-sky-700">{notice}</p> : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <form className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between" onSubmit={handleGenerate}>
          <div className="grid gap-3 md:flex md:flex-row md:items-center">
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
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-row md:items-center">
            <button
              type="button"
              onClick={() => setStatusFilter("FAILED")}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              仅看失败
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              重置筛选
            </button>
            <button
              type="button"
              onClick={selectAllFilteredPlans}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              全选当前筛选
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              清空已选
            </button>
          </div>
          <div className="grid gap-2 md:flex md:items-center md:gap-3">
            {error ? <p className="text-sm text-rose-600 md:mr-2">{error}</p> : null}
            {canExecute ? (
              <button
                type="button"
                onClick={handleBatchExecute}
                disabled={batchExecuting || batchStopping || loading}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {batchExecuting
                  ? "批量执行中..."
                  : selectedPlanIds.length > 0
                    ? `执行/重试选中 (${selectedPlanIds.length})`
                    : "执行/重试当前筛选"}
              </button>
            ) : null}
            {canExecute ? (
              <button
                type="button"
                onClick={handleBatchStop}
                disabled={batchExecuting || batchStopping || loading}
                className="rounded-lg border border-amber-200 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {batchStopping
                  ? "批量停止中..."
                  : selectedPlanIds.length > 0
                    ? `停止选中 (${selectedPlanIds.length})`
                    : "停止当前筛选"}
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={batchDeleting || loading}
                className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {batchDeleting
                  ? "批量删除中..."
                  : selectedPlanIds.length > 0
                    ? `删除选中 (${selectedPlanIds.length})`
                    : "删除当前筛选"}
              </button>
            ) : null}
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
        <div className="space-y-4 p-4 md:hidden">
          {filteredPlans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
              当前日期暂无计划，请先生成。
            </div>
          ) : (
            filteredPlans.map((plan) => {
              const isEditing = editingId === plan.id;

              return (
                <article key={plan.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedPlanIds.includes(plan.id)}
                          onChange={() => togglePlanSelection(plan.id)}
                        />
                        <p className="text-sm font-medium text-slate-900">{plan.account.nickname}</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{plan.task?.superTopic.name || "-"}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white px-2.5 py-1 text-slate-700">{getPlanTypeText(plan.planType)}</span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-slate-700">{statusText[plan.status]}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">{new Date(plan.scheduledTime).toLocaleString("zh-CN")}</div>
                  </div>

                  <div className="mt-3 rounded-xl bg-white p-3 text-sm text-slate-600">
                    {plan.planType === "FIRST_COMMENT" ? (
                      <span className="text-slate-500">自动使用任务配置中的首评文案池</span>
                    ) : isEditing && canManage ? (
                      <div className="space-y-3">
                        <input
                          type="datetime-local"
                          value={editScheduledTime}
                          onChange={(event) => setEditScheduledTime(event.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                        />
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
                      </div>
                    ) : (
                      plan.content?.content || "-"
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    {isEditing && canManage ? (
                      <>
                        <button onClick={() => saveEdit(plan.id)} className="text-emerald-600 hover:text-emerald-700">
                          保存
                        </button>
                        <button onClick={cancelEdit} className="text-slate-600 hover:text-slate-700">
                          取消
                        </button>
                      </>
                    ) : canManage || canExecute ? (
                      <>
                        {canManage ? (
                          <button onClick={() => startEdit(plan)} className="text-sky-600 hover:text-sky-700">
                            编辑
                          </button>
                        ) : null}
                        {canExecute ? (
                          <button onClick={() => handleExecute(plan.id)} className="text-violet-600 hover:text-violet-700">
                            执行
                          </button>
                        ) : null}
                        {canExecute && ["PENDING", "READY", "RUNNING"].includes(plan.status) ? (
                          <button onClick={() => handleStop(plan.id)} className="text-amber-700 hover:text-amber-800">
                            停止
                          </button>
                        ) : null}
                        {canManage ? (
                          <button onClick={() => handleDelete(plan.id)} className="text-rose-700 hover:text-rose-800">
                            删除
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-slate-400">只读</span>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>

        <table className="hidden w-full text-left text-sm md:table">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">选择</th>
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
                <td colSpan={8} className="px-6 py-8 text-slate-500">
                  当前日期暂无计划，请先生成。
                </td>
              </tr>
            ) : (
              filteredPlans.map((plan) => {
                const isEditing = editingId === plan.id;

                return (
                  <tr key={plan.id} className="border-t border-slate-200 align-top">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedPlanIds.includes(plan.id)}
                        onChange={() => togglePlanSelection(plan.id)}
                      />
                    </td>
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
                    <td className="px-6 py-4">{getPlanTypeText(plan.planType)}</td>
                    <td className="max-w-sm px-6 py-4 text-slate-600">
                      {plan.planType === "FIRST_COMMENT" ? (
                        <span className="text-slate-500">自动使用任务配置中的首评文案池</span>
                      ) : isEditing && canManage ? (
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
                                执行
                              </button>
                             ) : null}
                            {canExecute && ["PENDING", "READY", "RUNNING"].includes(plan.status) ? (
                              <button onClick={() => handleStop(plan.id)} className="text-amber-700 hover:text-amber-800">
                                停止
                              </button>
                            ) : null}
                             {canManage ? (
                               <button onClick={() => handleDelete(plan.id)} className="text-rose-700 hover:text-rose-800">
                                 删除
                               </button>
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
