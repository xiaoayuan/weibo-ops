import { requireSession } from "@/lib/auth";
import { getExecutionStrategy, getRiskRules } from "@/lib/app-data";
import { ExecutionStrategyForm } from "@/components/settings/execution-strategy-form";
import { RiskRulesForm } from "@/components/settings/risk-rules-form";
import { SurfaceCard } from "@/components/surface-card";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();

  const [strategy, riskRules] = await Promise.all([getExecutionStrategy(), getRiskRules()]);

  const defaultStrategy = strategy ?? {
    actionJob: {
      maxRetry: 1,
      commentLikeConcurrency: { S: 20, A: 5, B: 3 },
      repostConcurrency: { S: 6, A: 4, B: 2 },
      urgency: {
        S: { waveRatios: [0.3, 0.4, 0.3], waveWindowsSec: [5, 20, 60], cooldownSecRange: [8, 25], retryDelaySecRange: [2, 5], targetSlaSec: 300, limitSlaSec: 600 },
        A: { waveRatios: [0.2, 0.3, 0.5], waveWindowsSec: [600, 1800, 7200], cooldownSecRange: [20, 60], retryDelaySecRange: [4, 8], targetSlaSec: 600, limitSlaSec: 1800 },
        B: { waveRatios: [0.1, 0.2, 0.7], waveWindowsSec: [1800, 7200, 43200], cooldownSecRange: [60, 180], retryDelaySecRange: [8, 15], targetSlaSec: 1800, limitSlaSec: 7200 },
      },
    },
    circuitBreaker: {
      accountFailureThreshold: 3,
      accountPauseMinutes: 360,
      proxyWindowMinutes: 10,
      proxyMinSamples: 10,
      proxyFailureRatio: 0.4,
      proxyPauseMinutes: 30,
    },
  };

  const defaultRules = riskRules ?? {
    keywords: {
      targetIssue: ["目标不存在", "已删除", "deleted"],
      contentIssue: ["文案", "模板", "内容为空"],
      transientNetwork: ["timeout", "代理", "network"],
      platformBusy: ["系统繁忙", "稍后再试", "busy"],
      accountRisk: ["cookie", "登录失效", "风控", "rate limit"],
    },
    score: {
      success: -1,
      targetIssue: 0,
      contentIssue: 0,
      transientNetwork: 1,
      platformBusy: 1,
      accountRisk: 3,
      unknownFailure: 1,
    },
    threshold: {
      markRiskyAt: 8,
      recoverActiveAt: 3,
      maxRiskLevel: 20,
    },
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        eyebrow="系统设置"
        title="执行策略与风控规则"
        description="配置控评/轮转并发上限、熔断阈值和风控关键词匹配规则。修改后实时生效。"
        action={
          <SurfaceCard className="rounded-[20px] px-6 py-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-app-text-soft">当前用户</p>
                <p className="mt-1 text-base font-semibold text-app-text-strong">{session.username}</p>
              </div>
              <StatusBadge tone="accent">{session.role}</StatusBadge>
            </div>
          </SurfaceCard>
        }
      />

      <SurfaceCard className="rounded-[24px] p-6">
        <SectionHeader
          title="执行策略"
          description="控评与轮转并发上限，以及账号/代理熔断阈值配置。"
        />
        <div className="mt-5">
          <ExecutionStrategyForm initial={defaultStrategy} />
        </div>
      </SurfaceCard>

      <SurfaceCard className="rounded-[24px] p-6">
        <SectionHeader
          title="风控规则"
          description="失败日志关键词分类与风险加分规则，影响账号风险分动态计算。"
        />
        <div className="mt-5">
          <RiskRulesForm initial={defaultRules} />
        </div>
      </SurfaceCard>
    </div>
  );
}