import { prisma } from "@/lib/prisma";
import { classifyExecutionOutcome, type ExecutionErrorClass } from "@/server/risk/error-classifier";
import { getRiskRules } from "@/server/risk/rules";

type RiskInput = {
  accountId?: string;
  success: boolean;
  message?: string | null;
  responsePayload?: unknown;
};

export type RiskMeta = {
  errorClass: ExecutionErrorClass;
  riskDelta: number;
  consecutiveFailureDelta: number;
  riskLevelBefore?: number;
  riskLevelAfter?: number;
  consecutiveFailuresBefore?: number;
  consecutiveFailuresAfter?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function computeRiskDelta(errorClass: ExecutionErrorClass, rules: Awaited<ReturnType<typeof getRiskRules>>) {
  if (errorClass === "ACCOUNT_RISK") {
    return rules.score.accountRisk;
  }

  if (errorClass === "TRANSIENT_NETWORK") {
    return rules.score.transientNetwork;
  }

  if (errorClass === "PLATFORM_BUSY") {
    return rules.score.platformBusy;
  }

  if (errorClass === "TARGET_ISSUE") {
    return rules.score.targetIssue;
  }

  if (errorClass === "CONTENT_ISSUE") {
    return rules.score.contentIssue;
  }

  if (errorClass === "SUCCESS") {
    return rules.score.success;
  }

  return rules.score.unknownFailure;
}

export async function classifyAndApplyAccountRisk(input: RiskInput): Promise<RiskMeta> {
  const rules = await getRiskRules();
  const errorClass = classifyExecutionOutcome(input, rules);
  const riskDelta = computeRiskDelta(errorClass, rules);
  const failureDelta = input.success ? 0 : riskDelta > 0 ? 1 : 0;

  if (!input.accountId) {
    return {
      errorClass,
      riskDelta,
      consecutiveFailureDelta: failureDelta,
    };
  }

  const account = await prisma.weiboAccount.findUnique({
    where: { id: input.accountId },
    select: {
      id: true,
      status: true,
      riskLevel: true,
      consecutiveFailures: true,
    },
  });

  if (!account) {
    return {
      errorClass,
      riskDelta: 0,
      consecutiveFailureDelta: 0,
    };
  }

  const beforeRisk = account.riskLevel;
  const beforeFailures = account.consecutiveFailures;

  let nextRisk = beforeRisk;
  let nextFailures = beforeFailures;

  if (input.success) {
    nextRisk = clamp(beforeRisk + riskDelta, 0, rules.threshold.maxRiskLevel);
    nextFailures = 0;
  } else {
    nextRisk = clamp(beforeRisk + riskDelta, 0, rules.threshold.maxRiskLevel);
    nextFailures = beforeFailures + failureDelta;
  }

  let nextStatus = account.status;

  if (nextRisk >= rules.threshold.markRiskyAt && account.status === "ACTIVE") {
    nextStatus = "RISKY";
  }

  if (nextRisk <= rules.threshold.recoverActiveAt && account.status === "RISKY") {
    nextStatus = "ACTIVE";
  }

  await prisma.weiboAccount.update({
    where: { id: account.id },
    data: {
      riskLevel: nextRisk,
      consecutiveFailures: nextFailures,
      status: nextStatus,
      lastActiveAt: input.success ? new Date() : undefined,
    },
  });

  return {
    errorClass,
    riskDelta,
    consecutiveFailureDelta: input.success ? 0 : failureDelta,
    riskLevelBefore: beforeRisk,
    riskLevelAfter: nextRisk,
    consecutiveFailuresBefore: beforeFailures,
    consecutiveFailuresAfter: nextFailures,
  };
}

export function attachRiskMetaToPayload(payload: unknown, riskMeta: RiskMeta) {
  const base = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : { raw: payload ?? null };

  return {
    ...(base as Record<string, unknown>),
    riskMeta,
  };
}
