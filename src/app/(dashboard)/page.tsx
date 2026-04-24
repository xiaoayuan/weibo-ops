import Link from "next/link";

import { getBusinessDateText, toBusinessDate } from "@/lib/business-date";
import { getActionTypeText, getTaskStatusText } from "@/lib/display-text";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function readNumberField(payload: unknown, keys: string[]) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return 0;
  }

  const record = payload as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requirePageRole("VIEWER");
  const today = toBusinessDate(getBusinessDateText());

  const quickActions = [
    {
      href: "/accounts",
      title: "新增账号",
      description: "维护账号分组、状态和备注信息。",
    },
    {
      href: "/topic-tasks",
      title: "配置任务",
      description: "绑定账号与超话，设置签到规则。",
    },
    {
      href: "/plans",
      title: "查看计划",
      description: "调整当日计划时间、文案和执行状态。",
    },
    {
      href: "/interactions",
      title: "创建互动",
      description: "录入评论链接，批量生成互动任务。",
    },
  ];

  const [todayPlans, activeAccounts, failedPlans, pendingPlans, recentLogs, copywritingCount, recentPlans, todayPlanLogs] = await Promise.all([
    prisma.dailyPlan.count({
      where: {
        planDate: today,
        account: {
          ownerUserId: session.id,
        },
      },
    }),
    prisma.weiboAccount.count({
      where: {
        status: "ACTIVE",
        ownerUserId: session.id,
      },
    }),
    prisma.dailyPlan.count({
      where: {
        planDate: today,
        status: "FAILED",
        account: {
          ownerUserId: session.id,
        },
      },
    }),
    prisma.dailyPlan.count({
      where: {
        planDate: today,
        status: "PENDING",
        account: {
          ownerUserId: session.id,
        },
      },
    }),
    prisma.executionLog.findMany({
      where: {
        success: false,
        account: {
          ownerUserId: session.id,
        },
      },
      include: { account: true },
      orderBy: { executedAt: "desc" },
      take: 3,
    }),
    prisma.copywritingTemplate.count({ where: { status: "ACTIVE" } }),
    prisma.dailyPlan.findMany({
      where: {
        planDate: today,
        account: {
          ownerUserId: session.id,
        },
      },
      include: {
        account: true,
        task: {
          include: {
            superTopic: true,
          },
        },
      },
      orderBy: { scheduledTime: "asc" },
      take: 6,
    }),
    prisma.executionLog.findMany({
      where: {
        executedAt: {
          gte: today,
        },
        OR: [
          {
            userId: session.id,
          },
          {
            account: {
              ownerUserId: session.id,
            },
          },
        ],
        actionType: {
          in: ["PLAN_GENERATED", "PLAN_SCHEDULED", "PLAN_EXECUTE_PRECHECKED", "PLAN_EXECUTE_BLOCKED", "FIRST_COMMENT_EXECUTE_SUCCESS", "FIRST_COMMENT_EXECUTE_FAILED"],
        },
      },
      select: {
        actionType: true,
        success: true,
        responsePayload: true,
      },
    }),
  ]);

  const planGeneratedBatches = todayPlanLogs.filter((log) => log.actionType === "PLAN_GENERATED" && log.success).length;
  const generatedPlanCount = todayPlanLogs
    .filter((log) => log.actionType === "PLAN_GENERATED" && log.success)
    .reduce((sum, log) => sum + readNumberField(log.responsePayload, ["createdCount", "count"]), 0);
  const queuedPlanCount = todayPlanLogs
    .filter((log) => log.actionType === "PLAN_SCHEDULED" && log.success)
    .reduce((sum, log) => sum + readNumberField(log.responsePayload, ["queuedCount"]), 0);
  const executedSuccessCount = todayPlanLogs.filter(
    (log) =>
      (log.actionType === "PLAN_EXECUTE_PRECHECKED" || log.actionType === "FIRST_COMMENT_EXECUTE_SUCCESS") &&
      log.success,
  ).length;
  const executedFailedCount = todayPlanLogs.filter(
    (log) =>
      log.actionType === "PLAN_EXECUTE_BLOCKED" ||
      (log.actionType === "PLAN_EXECUTE_PRECHECKED" && !log.success) ||
      log.actionType === "FIRST_COMMENT_EXECUTE_FAILED",
  ).length;

  const stats = [
    { label: "今日计划", value: String(todayPlans) },
    { label: "活跃账号", value: String(activeAccounts) },
    { label: "失败任务", value: String(failedPlans) },
    { label: "待审核", value: String(pendingPlans) },
  ];

  const recentAlerts = [
    ...recentLogs.map(
      (log) =>
        `${log.account?.nickname || "系统"} 在 ${new Date(log.executedAt).toLocaleString("zh-CN")} 执行 ${getActionTypeText(log.actionType, log.requestPayload)} 失败。`,
    ),
    copywritingCount < 5 ? `当前启用文案仅剩 ${copywritingCount} 条，建议尽快补充文案池。` : null,
    pendingPlans > 0 ? `当前有 ${pendingPlans} 条计划处于待审核状态。` : null,
  ].filter(Boolean) as string[];

  const planExecutionStats = [
    { label: "生成批次", value: String(planGeneratedBatches), detail: `共生成 ${generatedPlanCount} 条计划` },
    { label: "入队计划", value: String(queuedPlanCount), detail: "今日进入执行队列的计划数" },
    { label: "执行成功", value: String(executedSuccessCount), detail: "含普通计划和首评成功" },
    { label: "执行失败", value: String(executedFailedCount), detail: "含拦截和执行失败" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">控制台</h2>
        <p className="mt-1 text-sm text-slate-500">查看今日任务、账号状态和异常情况。</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">计划生成与执行</h3>
            <p className="mt-1 text-sm text-slate-500">按今天的计划日志汇总生成、入队和执行结果。</p>
          </div>
          <Link href="/logs" className="text-sm text-sky-600 hover:text-sky-700">
            查看日志
          </Link>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {planExecutionStats.map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
              <p className="mt-2 text-xs text-slate-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">快捷入口</h3>
          <span className="text-sm text-slate-500">常用操作</span>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
            >
              <div className="text-base font-medium text-slate-900">{item.title}</div>
              <p className="mt-2 text-sm text-slate-500">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">最近计划</h3>
            <Link href="/plans" className="text-sm text-sky-600 hover:text-sky-700">
              查看全部
            </Link>
          </div>

          {recentPlans.length === 0 ? (
            <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">今日暂无计划。</div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">时间</th>
                    <th className="px-4 py-3 font-medium">账号</th>
                    <th className="px-4 py-3 font-medium">超话</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPlans.map((plan) => (
                    <tr key={plan.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">{new Date(plan.scheduledTime).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-4 py-3">{plan.account.nickname}</td>
                      <td className="px-4 py-3">{plan.task?.superTopic.name || "-"}</td>
                      <td className="px-4 py-3">{getTaskStatusText(plan.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium">最近异常</h3>
          {recentAlerts.length === 0 ? (
            <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">暂无异常，当前任务状态稳定。</div>
          ) : (
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {recentAlerts.map((item) => (
                <li key={item} className="rounded-lg bg-slate-50 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
