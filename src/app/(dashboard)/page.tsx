import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function todayDate() {
  return new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
}

export default async function DashboardPage() {
  const today = todayDate();

  const quickActions = [
    {
      href: "/accounts",
      title: "新增账号",
      description: "维护账号分组、状态和备注信息。",
    },
    {
      href: "/topic-tasks",
      title: "配置任务",
      description: "绑定账号与超话，设置签到和发帖规则。",
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

  const [todayPlans, activeAccounts, failedPlans, readyPlans, recentLogs, copywritingCount, recentPlans] = await Promise.all([
    prisma.dailyPlan.count({ where: { planDate: today } }),
    prisma.weiboAccount.count({ where: { status: "ACTIVE" } }),
    prisma.dailyPlan.count({ where: { planDate: today, status: "FAILED" } }),
    prisma.dailyPlan.count({ where: { planDate: today, status: "READY" } }),
    prisma.executionLog.findMany({
      where: { success: false },
      include: { account: true },
      orderBy: { executedAt: "desc" },
      take: 3,
    }),
    prisma.copywritingTemplate.count({ where: { status: "ACTIVE" } }),
    prisma.dailyPlan.findMany({
      where: { planDate: today },
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
  ]);

  const stats = [
    { label: "今日计划", value: String(todayPlans) },
    { label: "活跃账号", value: String(activeAccounts) },
    { label: "失败任务", value: String(failedPlans) },
    { label: "待审核", value: String(readyPlans) },
  ];

  const recentAlerts = [
    ...recentLogs.map((log) => `${log.account?.nickname || "系统"} 在 ${new Date(log.executedAt).toLocaleString("zh-CN")} 执行 ${log.actionType} 失败。`),
    copywritingCount < 5 ? `当前启用文案仅剩 ${copywritingCount} 条，建议尽快补充文案池。` : null,
    readyPlans > 0 ? `当前有 ${readyPlans} 条计划处于待确认状态。` : null,
  ].filter(Boolean) as string[];

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
                      <td className="px-4 py-3">{plan.status}</td>
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
