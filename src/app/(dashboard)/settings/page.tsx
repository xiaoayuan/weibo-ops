import { getBusinessDateText, toBusinessDate } from "@/lib/business-date";
import { getActionTypeText } from "@/lib/display-text";
import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ProfileSecurityForm } from "@/components/settings/profile-security-form";
import { ProxyPoolForm } from "@/components/settings/proxy-pool-form";
import { RiskRulesForm } from "@/components/settings/risk-rules-form";
import { ExecutionStrategyForm } from "@/components/settings/execution-strategy-form";
import { ExecutorHealthCard } from "@/components/settings/executor-health-card";
import { getExecutorHealthStatus } from "@/server/executors";
import { sanitizeProxySettings } from "@/server/proxy-config";
import { getRiskRules } from "@/server/risk/rules";
import { getExecutionStrategy } from "@/server/strategy/config";

export const dynamic = "force-dynamic";

function isPlaceholderValue(value: string | undefined) {
  if (!value) {
    return true;
  }

  return value.includes("replace_me") || value === "dev-secret";
}

function getSecretStatus(value: string | undefined, minLength: number) {
  if (!value) {
    return { label: "未配置", tone: "rose" as const, detail: "未检测到环境变量" };
  }

  if (isPlaceholderValue(value)) {
    return { label: "占位值", tone: "amber" as const, detail: "仍在使用示例或默认值" };
  }

  if (value.length < minLength) {
    return { label: "强度不足", tone: "amber" as const, detail: `长度少于 ${minLength} 位` };
  }

  return { label: "已配置", tone: "emerald" as const, detail: `长度满足至少 ${minLength} 位` };
}

function maskDatabaseUrl(value: string | undefined) {
  if (!value) {
    return "未配置 DATABASE_URL";
  }

  try {
    const url = new URL(value);
    const username = url.username ? `${url.username.slice(0, 2)}***` : "-";
    const databaseName = url.pathname.replace(/^\//, "") || "-";

    return `${url.protocol}//${username}@${url.hostname}:${url.port || "default"}/${databaseName}`;
  } catch {
    return "DATABASE_URL 格式无法解析";
  }
}

function toneClasses(tone: "emerald" | "amber" | "rose" | "slate") {
  if (tone === "emerald") {
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  }

  if (tone === "amber") {
    return "bg-amber-50 text-amber-700 border border-amber-200";
  }

  if (tone === "rose") {
    return "bg-rose-50 text-rose-700 border border-rose-200";
  }

  return "bg-slate-100 text-slate-700 border border-slate-200";
}

export default async function SettingsPage() {
  const session = await requirePageRole("ADMIN");
  const currentUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      username: true,
      proxyEnabled: true,
      proxyProtocol: true,
      proxyHost: true,
      proxyPort: true,
      proxyUsername: true,
      proxyPasswordEncrypted: true,
      taskConcurrency: true,
      autoGenerateEnabled: true,
      autoGenerateTime: true,
      autoExecuteEnabled: true,
      autoExecuteStartTime: true,
    },
  });

  const today = toBusinessDate(getBusinessDateText());
  const [userCount, accountCount, activeCopyCount, todayPlanCount, failedLogCount, recentFailedPlans, recentFailedInteractions, dbHealth, riskRules, executionStrategy, proxyNodes, executorStatus] = await Promise.all([
    prisma.user.count(),
    prisma.weiboAccount.count({ where: { ownerUserId: session.id } }),
    prisma.copywritingTemplate.count({ where: { status: "ACTIVE" } }),
    prisma.dailyPlan.count({
      where: {
        planDate: today,
        account: {
          ownerUserId: session.id,
        },
      },
    }),
    prisma.executionLog.count({
      where: {
        success: false,
        account: {
          ownerUserId: session.id,
        },
      },
    }),
    prisma.dailyPlan.findMany({
      where: {
        status: "FAILED",
        account: {
          ownerUserId: session.id,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: {
        account: true,
        task: { include: { superTopic: true } },
      },
    }),
    prisma.interactionTask.findMany({
      where: {
        status: "FAILED",
        account: {
          ownerUserId: session.id,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: {
        account: true,
        target: true,
      },
    }),
    prisma.$queryRaw`SELECT 1`,
    getRiskRules(),
    getExecutionStrategy(),
    prisma.proxyNode.findMany({
      where: { ownerUserId: session.id },
      include: {
        _count: {
          select: { accounts: true },
        },
      },
      orderBy: [{ enabled: "desc" }, { createdAt: "asc" }],
    }),
    Promise.resolve(getExecutorHealthStatus()),
  ]);

  const authCookieSecure = process.env.AUTH_COOKIE_SECURE === "true";
  const jwtSecretStatus = getSecretStatus(process.env.JWT_SECRET, 16);
  const accountSecretStatus = getSecretStatus(process.env.ACCOUNT_SECRET_KEY, 32);
  const databaseUrlSummary = maskDatabaseUrl(process.env.DATABASE_URL);
  const dbStatus = Array.isArray(dbHealth) ? "已连接" : "检测异常";
  const recentFailures = [
    ...recentFailedPlans.map((plan) => ({
      id: plan.id,
      type: "计划" as const,
      title: `${plan.account.nickname} / ${
        plan.planType === "CHECK_IN"
          ? "签到"
          : plan.planType === "FIRST_COMMENT"
            ? "首评"
            : plan.planType === "POST"
              ? "转发"
              : plan.planType === "COMMENT"
                ? "回复"
                : "点赞"
      }`,
      subtitle: plan.task?.superTopic.name || "未绑定超话",
      detail: plan.resultMessage || "无失败说明",
      occurredAt: plan.updatedAt,
    })),
    ...recentFailedInteractions.map((task) => ({
      id: task.id,
      type: "互动" as const,
      title: `${task.account.nickname} / ${getActionTypeText(task.actionType)}`,
      subtitle: task.target.targetUrl,
      detail: task.resultMessage || "无失败说明",
      occurredAt: task.updatedAt,
    })),
  ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, 5);

  const summaryCards = [
    { label: "后台用户", value: String(userCount) },
    { label: "账号总数", value: String(accountCount) },
    { label: "启用文案", value: String(activeCopyCount) },
    { label: "今日计划", value: String(todayPlanCount) },
    { label: "失败日志", value: String(failedLogCount) },
  ];

  const configItems = [
    {
      label: "执行器模式",
      value: executorStatus.mode,
      detail: executorStatus.isRealExecutor ? "已启用真实执行器" : "当前不是真实执行器",
      tone: executorStatus.isRealExecutor ? "emerald" : "rose",
    },
    {
      label: "Cookie 安全策略",
      value: authCookieSecure ? "Secure" : "Non-Secure",
      detail: authCookieSecure ? "仅建议在 HTTPS 下使用" : "当前允许 HTTP 环境登录",
      tone: authCookieSecure ? "emerald" : "amber",
    },
    {
      label: "JWT_SECRET",
      value: jwtSecretStatus.label,
      detail: jwtSecretStatus.detail,
      tone: jwtSecretStatus.tone,
    },
    {
      label: "ACCOUNT_SECRET_KEY",
      value: accountSecretStatus.label,
      detail: accountSecretStatus.detail,
      tone: accountSecretStatus.tone,
    },
    {
      label: "DATABASE_URL",
      value: databaseUrlSummary,
      detail: "仅展示脱敏后的连接摘要",
      tone: process.env.DATABASE_URL ? "slate" : "rose",
    },
    {
      label: "数据库状态",
      value: dbStatus,
      detail: dbStatus === "已连接" ? "Prisma 查询已通过连通性检查" : "数据库健康检查未通过",
      tone: dbStatus === "已连接" ? "emerald" : "rose",
    },
  ] as const;

  const risks = [
    !authCookieSecure
      ? { title: "Cookie 未启用 Secure", description: "如果系统已迁移到 HTTPS，建议将 AUTH_COOKIE_SECURE 调整为 true。", tone: "amber" as const }
      : null,
    jwtSecretStatus.tone !== "emerald"
      ? { title: "JWT_SECRET 需要加强", description: "当前登录签名密钥未达到推荐安全级别。", tone: "rose" as const }
      : null,
    accountSecretStatus.tone !== "emerald"
      ? { title: "账号密钥存在风险", description: "账号 Cookie 加密密钥未达到推荐安全级别。", tone: "rose" as const }
      : null,
    dbStatus !== "已连接"
      ? { title: "数据库连通性异常", description: "设置页未能完成基础数据库健康检查。", tone: "rose" as const }
      : null,
    !executorStatus.isRealExecutor
      ? { title: "执行器未走真实链路", description: "当前实例判定为非真实执行器，请立即核对部署环境。", tone: "rose" as const }
      : null,
    !executorStatus.modeMatchesExecutor
      ? { title: "执行器模式与实现不一致", description: "EXECUTOR_MODE 与当前执行器实现不匹配，建议检查容器环境变量。", tone: "amber" as const }
      : null,
  ].filter(Boolean) as Array<{ title: string; description: string; tone: "amber" | "rose" }>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">系统设置</h2>
        <p className="mt-1 text-sm text-slate-500">仅管理员可查看系统配置摘要、运行状态和环境风险。</p>
      </div>

      <ProfileSecurityForm
        initialUsername={session.username}
        initialProxySettings={sanitizeProxySettings(currentUser || {})}
        initialTaskConcurrency={currentUser?.taskConcurrency || 1}
        initialAutoGenerateEnabled={currentUser?.autoGenerateEnabled ?? true}
        initialAutoGenerateTime={currentUser?.autoGenerateTime || "00:10"}
        initialAutoExecuteEnabled={currentUser?.autoExecuteEnabled ?? true}
        initialAutoExecuteStartTime={currentUser?.autoExecuteStartTime || "09:00"}
      />
      <ProxyPoolForm
        initialNodes={proxyNodes.map((node) => ({
          id: node.id,
          name: node.name,
          protocol: node.protocol,
          host: node.host,
          port: node.port,
          username: node.username,
          enabled: node.enabled,
          maxAccounts: node.maxAccounts,
          assignedAccounts: node._count.accounts,
          hasPassword: Boolean(node.passwordEncrypted),
        }))}
      />
      <ExecutionStrategyForm initialConfig={executionStrategy} />
      <RiskRulesForm initialRules={riskRules} />
      <ExecutorHealthCard initialStatus={executorStatus} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium">配置摘要</h3>
            <p className="mt-1 text-sm text-slate-500">读取当前环境变量并做脱敏展示，不直接写入 `.env`。</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">只读</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {configItems.map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="mt-2 break-all text-sm font-medium text-slate-900">{item.value}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses(item.tone)}`}>
                  {item.tone === "emerald" ? "正常" : item.tone === "amber" ? "注意" : item.tone === "rose" ? "风险" : "信息"}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium">风险提示</h3>
          {risks.length === 0 ? (
            <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">当前未发现明显的环境配置风险。</div>
          ) : (
            <div className="mt-4 space-y-3">
              {risks.map((risk) => (
                <div key={risk.title} className={`rounded-lg px-4 py-3 text-sm ${toneClasses(risk.tone)}`}>
                  <p className="font-medium">{risk.title}</p>
                  <p className="mt-1">{risk.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium">运行边界</h3>
          <div className="mt-4 space-y-4 text-sm text-slate-600">
            <p>1. 本页只展示系统配置摘要，不直接修改数据库或部署环境。</p>
            <p>2. 登录鉴权通过 `JWT_SECRET` 生成 Cookie，页面和 API 都统一走角色校验。</p>
            <p>3. 如果需要切换执行器或加强密钥，请更新 `.env` 后重新部署服务。</p>
            <p>4. 敏感值只展示脱敏状态，避免在后台直接暴露真实密钥内容。</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium">数据库连通性</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <span>健康状态</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses(dbStatus === "已连接" ? "emerald" : "rose")}`}>
                {dbStatus}
              </span>
            </div>
            <p>当前通过 Prisma 发起了一次只读探测，用于确认应用和数据库之间的连接是可用的。</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium">最近失败任务</h3>
          {recentFailures.length === 0 ? (
            <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">最近没有失败计划或失败互动任务。</div>
          ) : (
            <div className="mt-4 space-y-3">
              {recentFailures.map((item) => (
                <div key={`${item.type}-${item.id}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">[{item.type}] {item.title}</p>
                      <p className="mt-1 break-all text-sm text-slate-500">{item.subtitle}</p>
                    </div>
                    <span className="text-xs text-slate-400">{item.occurredAt.toLocaleString("zh-CN")}</span>
                  </div>
                  <p className="mt-3 text-sm text-rose-600">{item.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
