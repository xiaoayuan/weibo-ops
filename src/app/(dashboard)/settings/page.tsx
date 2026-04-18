import { requirePageRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function startOfToday() {
  return new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
}

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
  await requirePageRole("ADMIN");

  const today = startOfToday();
  const [userCount, accountCount, activeCopyCount, todayPlanCount, failedLogCount] = await Promise.all([
    prisma.user.count(),
    prisma.weiboAccount.count(),
    prisma.copywritingTemplate.count({ where: { status: "ACTIVE" } }),
    prisma.dailyPlan.count({ where: { planDate: today } }),
    prisma.executionLog.count({ where: { success: false } }),
  ]);

  const executorMode = process.env.EXECUTOR_MODE === "weibo" ? "weibo" : "mock";
  const authCookieSecure = process.env.AUTH_COOKIE_SECURE === "true";
  const jwtSecretStatus = getSecretStatus(process.env.JWT_SECRET, 16);
  const accountSecretStatus = getSecretStatus(process.env.ACCOUNT_SECRET_KEY, 32);
  const databaseUrlSummary = maskDatabaseUrl(process.env.DATABASE_URL);

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
      value: executorMode,
      detail: executorMode === "weibo" ? "已启用真实执行器骨架" : "当前仍为 mock 执行模式",
      tone: executorMode === "weibo" ? "emerald" : "amber",
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
  ] as const;

  const risks = [
    executorMode === "mock"
      ? { title: "执行器仍为 mock", description: "当前执行预检不会触发真实签到、发帖或互动动作。", tone: "amber" as const }
      : null,
    !authCookieSecure
      ? { title: "Cookie 未启用 Secure", description: "如果系统已迁移到 HTTPS，建议将 AUTH_COOKIE_SECURE 调整为 true。", tone: "amber" as const }
      : null,
    jwtSecretStatus.tone !== "emerald"
      ? { title: "JWT_SECRET 需要加强", description: "当前登录签名密钥未达到推荐安全级别。", tone: "rose" as const }
      : null,
    accountSecretStatus.tone !== "emerald"
      ? { title: "账号密钥存在风险", description: "账号 Cookie 加密密钥未达到推荐安全级别。", tone: "rose" as const }
      : null,
  ].filter(Boolean) as Array<{ title: string; description: string; tone: "amber" | "rose" }>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">系统设置</h2>
        <p className="mt-1 text-sm text-slate-500">仅管理员可查看系统配置摘要、运行状态和环境风险。</p>
      </div>

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
    </div>
  );
}
