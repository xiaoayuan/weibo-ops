"use client";

import { AlertCircle, CalendarDays, LoaderCircle, Play, ShieldCheck, Square, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { AppNotice } from "@/components/app-notice";
import type { CopywritingTemplate, Plan } from "@/lib/app-data";
import { getBusinessDateText, toLocalDateTimeValue } from "@/lib/date";
import { readJsonResponse } from "@/lib/http";
import { getPlanStatusText } from "@/lib/text";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { TableShell } from "@/components/table-shell";

function getPlanTypeText(planType: string) {
  const map: Record<string, string> = {
    CHECK_IN: "签到",
    FIRST_COMMENT: "首评",
    POST: "发帖",
    REPOST: "转发",
    COMMENT: "回复",
    LIKE: "点赞",
  };

  return map[planType] || planType;
}

type PlanStatus = "ALL" | "INCOMPLETE" | "PENDING" | "READY" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";

function summarizePlanRefreshMessage(actionLabel: string, nextPlan?: Plan) {
  if (!nextPlan) {
    return `${actionLabel}，列表已刷新。`;
  }

  if (nextPlan.status === "PENDING" || nextPlan.status === "RUNNING") {
    return `${actionLabel}，但计划当前仍处于${getPlanStatusText(nextPlan.status)}，可能还在排队或执行中，请稍后刷新确认。`;
  }

  return `${actionLabel}，列表已刷新。`;
}

export function PlansManager({
  initialPlans,
  initialDate,
  contents,
}: {
  initialPlans: Plan[];
  initialDate: string;
  contents: CopywritingTemplate[];
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [date, setDate] = useState(initialDate);
  const [statusFilter, setStatusFilter] = useState<PlanStatus>("ALL");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduledTime, setScheduledTime] = useState("");
  const [contentId, setContentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const accountOptions = useMemo(() => Array.from(new Set(plans.map((plan) => plan.account.nickname))), [plans]);
  const filteredPlans = plans.filter((plan) => {
    let matchesStatus = true;
    if (statusFilter === "INCOMPLETE") {
      matchesStatus = !["SUCCESS", "CANCELLED"].includes(plan.status);
    } else if (statusFilter !== "ALL") {
      matchesStatus = plan.status === statusFilter;
    }
    const matchesAccount = accountFilter === "ALL" || plan.account.nickname === accountFilter;

    return matchesStatus && matchesAccount;
  });

  const summary = {
    total: filteredPlans.length,
    completed: filteredPlans.filter((plan) => plan.status === "SUCCESS").length,
    incomplete: filteredPlans.filter((plan) => !["SUCCESS", "CANCELLED"].includes(plan.status)).length,
    running: filteredPlans.filter((plan) => plan.status === "RUNNING").length,
    failed: filteredPlans.filter((plan) => plan.status === "FAILED").length,
  };

  const handleIncompleteClick = () => {
    setStatusFilter("INCOMPLETE");
  };

  async function reloadPlans(targetDate = date) {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/plans?date=${targetDate}`, { cache: "no-store" });
      const result = await readJsonResponse<{ success: boolean; message?: string; data: Plan[] }>(response);

      if (!response.ok) {
        throw new Error(result.message || "获取计划失败");
      }

      setPlans(result.data);
      setNotice(targetDate === getBusinessDateText() ? "当前展示今天的计划。" : `当前展示 ${targetDate} 的计划。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "获取计划失败");
    } finally {
      setLoading(false);
    }
  }

  async function generatePlans() {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const result = await readJsonResponse<{ success: boolean; message?: string; data: Plan[] } & { meta?: { createdCount?: number } }>(response);

      if (!response.ok) {
        throw new Error(result.message || "生成计划失败");
      }

      await reloadPlans(date);
      setNotice(result.message || "生成完成，列表已刷新");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成计划失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function runPlanAction(path: string, successMessage?: string) {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(path, { method: "POST" });
      const result = await readJsonResponse<{ success: boolean; message?: string; data?: Plan }>(response);

      if (!response.ok) {
        throw new Error(result.message || "操作失败");
      }

      const nextPlan = result.data;

      if (nextPlan?.id) {
        setPlans((current) => current.map((plan) => (plan.id === nextPlan.id ? nextPlan : plan)));
      }

      await reloadPlans(date);
      setNotice(result.message || summarizePlanRefreshMessage(successMessage || "操作完成", nextPlan));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePlan(id: string) {
    if (!window.confirm("确认删除这条计划吗？")) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/plans/${id}`, { method: "DELETE" });
      const result = await readJsonResponse<{ success: boolean; message?: string }>(response);

      if (!response.ok) {
        throw new Error(result.message || "删除计划失败");
      }

      await reloadPlans(date);
      setNotice(result.message || "计划已删除，列表已刷新");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除计划失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function savePlanEdit(id: string) {
    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledTime: scheduledTime ? new Date(scheduledTime).toISOString() : undefined,
          contentId: contentId || null,
        }),
      });
      const result = await readJsonResponse<{ success: boolean; message?: string; data: Plan }>(response);

      if (!response.ok) {
        throw new Error(result.message || "更新计划失败");
      }

      await reloadPlans(date);
      setEditingId(null);
      setScheduledTime("");
      setContentId("");
      setNotice("计划已更新，列表已刷新");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "更新计划失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        eyebrow="计划控制页"
        title="按业务日期管理计划生成、调度和执行"
        description="这版先把今天和指定日期的计划视图迁到独立前端，并接上生成、执行、停止、人工确认和删除这些高频动作。"
        action={
          <div className="flex flex-wrap gap-3">
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="app-input h-12 w-[180px]" />
            <button type="button" onClick={() => void reloadPlans()} className="app-button app-button-secondary">
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              刷新
            </button>
            <button type="button" onClick={() => void generatePlans()} disabled={submitting} className="app-button app-button-primary">
              <CalendarDays className="mr-2 h-4 w-4" />
              生成计划
            </button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-5">
        <StatCard label="计划总数" value={String(summary.total)} detail="当前筛选结果" accent="accent" icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label="已完成" value={String(summary.completed)} detail="成功执行的计划" accent="success" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="未完成" value={String(summary.incomplete)} detail="待处理、执行中、失败，点击筛选" accent="warning" icon={<AlertCircle className="h-5 w-5" />} onClick={handleIncompleteClick} cursorPointer />
        <StatCard label="执行中" value={String(summary.running)} detail="已进入执行阶段" accent="info" icon={<Play className="h-5 w-5" />} />
        <StatCard label="失败数" value={String(summary.failed)} detail="需要关注的异常" accent="danger" icon={<Square className="h-5 w-5" />} />
      </section>

      <SurfaceCard>
        <SectionHeader
          title="计划列表"
          description="按日期、状态和账号快速切换视图，并在同一处完成高频处理。"
          action={
            <div className="flex flex-wrap gap-3">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PlanStatus)} className="app-input h-12 w-[180px]">
                <option value="ALL">全部状态</option>
                <option value="INCOMPLETE">未完成</option>
                <option value="PENDING">待执行</option>
                <option value="READY">待确认</option>
                <option value="RUNNING">执行中</option>
                <option value="SUCCESS">已成功</option>
                <option value="FAILED">已失败</option>
                <option value="CANCELLED">已取消</option>

              </select>
              <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} className="app-input h-12 w-[220px]">
                <option value="ALL">全部账号</option>
                {accountOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        {error ? <AppNotice tone="error" className="mt-4">{error}</AppNotice> : null}
        {notice ? <AppNotice tone="success" className="mt-4">{notice}</AppNotice> : null}

        {filteredPlans.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="当前筛选下没有计划" description="你可以切换业务日期、刷新列表，或者直接为当前日期生成一批计划。" />
          </div>
        ) : (
          <TableShell className="mt-5">
            <table className="app-table min-w-[1280px]">
              <thead>
                <tr>
                  <th>计划</th>
                  <th>账号 / 超话</th>
                  <th>文案</th>
                  <th>状态</th>
                  <th>说明</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.map((plan) => {
                  const isEditing = editingId === plan.id;

                  return (
                    <tr key={plan.id}>
                      <td>
                        <p className="font-medium text-app-text-strong">{getPlanTypeText(plan.planType)}</p>
                        <p className="mt-1 font-mono text-xs text-app-text-soft">{new Date(plan.scheduledTime).toLocaleString("zh-CN")}</p>
                        {isEditing ? (
                          <input value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)} type="datetime-local" className="app-input mt-3 h-11 w-[220px]" />
                        ) : null}
                      </td>
                      <td>
                        <p className="font-medium text-app-text-strong">{plan.account.nickname}</p>
                        <p className="mt-1 text-xs text-app-text-soft">{plan.task?.superTopic?.name || "-"}</p>
                      </td>
                      <td>
                        {isEditing ? (
                          <select value={contentId} onChange={(event) => setContentId(event.target.value)} className="app-input h-11 w-[220px]">
                            <option value="">清空文案</option>
                            {contents.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.title}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div>
                            <p className="text-sm text-app-text-strong">{plan.content?.title || "未绑定文案"}</p>
                            <p className="mt-1 max-w-[280px] truncate text-xs text-app-text-soft">{plan.content?.content || plan.resultMessage || "-"}</p>
                          </div>
                        )}
                      </td>
                      <td>
                        <StatusBadge tone={plan.status === "SUCCESS" ? "success" : plan.status === "FAILED" ? "danger" : plan.status === "RUNNING" ? "info" : plan.status === "READY" ? "accent" : "neutral"}>
                          {plan.status === "PENDING" ? "待执行" : plan.status === "READY" ? "待确认" : plan.status === "RUNNING" ? "执行中" : plan.status === "SUCCESS" ? "已成功" : plan.status === "FAILED" ? "已失败" : "已取消"}
                        </StatusBadge>
                        {plan.status === "FAILED" && plan.error ? (
                          <p className="mt-1 text-xs text-app-danger">{plan.error}</p>
                        ) : null}
                      </td>
                      <td className="max-w-[240px] text-xs leading-6 text-app-text-soft">{plan.pendingReason || plan.scheduleNote || plan.resultMessage || "-"}</td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          {isEditing ? (
                            <>
                              <button type="button" onClick={() => void savePlanEdit(plan.id)} disabled={submitting} className="app-button app-button-primary h-10 px-4 text-xs">
                                保存
                              </button>
                              <button type="button" onClick={() => setEditingId(null)} className="app-button app-button-secondary h-10 px-4 text-xs">
                                取消
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(plan.id);
                                  setScheduledTime(toLocalDateTimeValue(plan.scheduledTime));
                                  setContentId(plan.contentId || "");
                                }}
                                className="app-button app-button-secondary h-10 px-4 text-xs"
                              >
                                编辑
                              </button>
                              <button type="button" onClick={() => void runPlanAction(`/api/plans/${plan.id}/execute`, "计划已入队")} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs">
                                <Play className="mr-1.5 h-3.5 w-3.5" />执行
                              </button>
                              <button type="button" onClick={() => void runPlanAction(`/api/plans/${plan.id}/approve`, "计划已确认")} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs">
                                通过
                              </button>
                              <button type="button" onClick={() => void runPlanAction(`/api/plans/${plan.id}/reject`, "计划已驳回")} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs">
                                驳回
                              </button>
                              <button type="button" onClick={() => void runPlanAction(`/api/plans/${plan.id}/stop`, "计划已停止")} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs">
                                <Square className="mr-1.5 h-3.5 w-3.5" />停止
                              </button>
                              <button type="button" onClick={() => void deletePlan(plan.id)} disabled={submitting} className="app-button app-button-secondary h-10 px-4 text-xs text-app-danger hover:border-app-danger/30 hover:text-app-danger">
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" />删除
                              </button>
                            </>
                          )}
                        </div>
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
