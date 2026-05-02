import { Activity, CircleAlert, NotebookTabs, Radar, Users } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { SurfaceCard } from "@/components/surface-card";
import { getAccounts, getLogs, getTodayPlans, getTopicTasks } from "@/lib/app-data";
import { formatDateTime, formatTime, getBusinessDateText } from "@/lib/date";
import { getActionTypeText, getPlanStatusText } from "@/lib/text";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireSession();

  const [accounts, plans, logs, topicTasks] = await Promise.all([getAccounts(), getTodayPlans(), getLogs(), getTopicTasks()]);
  const activeAccounts = accounts.filter((account) => account.status === "ACTIVE").length;
  const onlineAccounts = accounts.filter((account) => account.loginStatus === "ONLINE").length;
  const failedPlans = plans.filter((plan) => plan.status === "FAILED").length;
  const pendingPlans = plans.filter((plan) => plan.status === "PENDING" || plan.status === "READY").length;
  const failedLogs = logs.filter((log) => !log.success);
  const recentPlans = plans.slice(0, 6);
  const recentAlerts = failedLogs.slice(0, 4);

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        eyebrow="总览驾驶舱"
        title="围绕任务执行、账号健康和异常告警建立第一屏"
        description="统一查看今日计划、账号状态、异常日志和任务配置。"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="今日计划" value={String(plans.length)} detail={`${getBusinessDateText()} 的业务时区数据`} accent="accent" icon={<NotebookTabs className="h-5 w-5" />} />
        <StatCard label="活跃账号" value={String(activeAccounts)} detail={`其中 ${onlineAccounts} 个登录态在线`} accent="success" icon={<Users className="h-5 w-5" />} />
        <StatCard label="待处理任务" value={String(pendingPlans)} detail="含待执行和待确认状态" accent="warning" icon={<Radar className="h-5 w-5" />} />
        <StatCard label="异常日志" value={String(failedLogs.length)} detail={`${topicTasks.length} 条任务配置正在生效`} accent="danger" icon={<CircleAlert className="h-5 w-5" />} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SurfaceCard>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-app-text-strong">今日计划</h2>
              <p className="mt-2 text-sm leading-relaxed text-app-text-muted">查看当日执行计划和任务状态。</p>
            </div>
            <StatusBadge tone={failedPlans > 0 ? "warning" : "success"}>{failedPlans > 0 ? `${failedPlans} 条失败` : "运行稳定"}</StatusBadge>
          </div>

          {recentPlans.length === 0 ? (
            <div className="mt-6">
              <EmptyState title="今日暂无计划" description="当前业务日期下没有生成计划，稍后可以继续接入生成和审核操作。" />
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-[24px] border border-app-line shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="overflow-x-auto">
                <table className="app-table min-w-full">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>账号</th>
                      <th>超话</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPlans.map((plan) => (
                      <tr key={plan.id} className="group">
                        <td className="font-mono text-xs text-app-text-soft group-hover:text-app-text">{formatTime(plan.scheduledTime)}</td>
                        <td className="font-medium text-app-text-strong">{plan.account.nickname}</td>
                        <td className="text-app-text">{plan.task?.superTopic?.name || <span className="text-app-text-soft">-</span>}</td>
                        <td>
                          <StatusBadge tone={plan.status === "SUCCESS" ? "success" : plan.status === "FAILED" ? "danger" : plan.status === "RUNNING" ? "info" : "neutral"}>
                            {getPlanStatusText(plan.status)}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-app-text-strong">最近异常</h2>
              <p className="mt-2 text-sm leading-relaxed text-app-text-muted">查看最近的失败日志，快速定位问题。</p>
            </div>
            <div className="rounded-full border border-app-danger/20 bg-app-danger/10 p-2.5 shadow-[0_0_12px_rgba(243,154,167,0.2)]">
              <Activity className="h-5 w-5 text-app-danger" />
            </div>
          </div>

          {recentAlerts.length === 0 ? (
            <div className="mt-6">
              <EmptyState title="暂无异常" description="最近 50 条日志里没有失败记录，当前执行链路状态看起来比较平稳。" />
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {recentAlerts.map((log) => (
                <div key={log.id} className="group relative overflow-hidden rounded-[22px] border border-rose-400/20 bg-rose-400/8 px-4 py-4 shadow-[0_0_16px_rgba(243,154,167,0.08)] transition-all duration-300 hover:border-rose-400/30 hover:bg-rose-400/12 hover:shadow-[0_0_20px_rgba(243,154,167,0.15)]">
                  <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-app-danger/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge tone="danger">失败</StatusBadge>
                    <span className="text-sm font-semibold text-app-text-strong">{getActionTypeText(log.actionType)}</span>
                    <span className="text-xs font-mono text-app-text-soft">{formatDateTime(log.executedAt)}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-rose-200/90">{log.account?.nickname || "系统"}：{log.errorMessage || "未返回详细错误，建议继续下钻日志接口。"}</p>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
