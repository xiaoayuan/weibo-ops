import { prisma } from "@/lib/prisma";
import { classifyExecutionOutcome, type ExecutionErrorClass } from "@/server/risk/error-classifier";

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

function computeFailureDelta(errorClass: ExecutionErrorClass) {
  if (errorClass === "ACCOUNT_RISK") {
    return { riskDelta: 3, failureDelta: 1 };
  }

  if (errorClass === "TRANSIENT_NETWORK" || errorClass === "PLATFORM_BUSY") {
    return { riskDelta: 1, failureDelta: 1 };
  }

  if (errorClass === "TARGET_ISSUE" || errorClass === "CONTENT_ISSUE") {
    return { riskDelta: 0, failureDelta: 0 };
  }

  return { riskDelta: 1, failureDelta: 1 };
}

export async function classifyAndApplyAccountRisk(input: RiskInput): Promise<RiskMeta> {
  const errorClass = classifyExecutionOutcome(input);

  if (!input.accountId) {
    return {
      errorClass,
      riskDelta: input.success ? -1 : computeFailureDelta(errorClass).riskDelta,
      consecutiveFailureDelta: input.success ? 0 : computeFailureDelta(errorClass).failureDelta,
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

  let riskDelta = 0;
  let failureDelta = 0;
  let nextRisk = beforeRisk;
  let nextFailures = beforeFailures;

  if (input.success) {
    riskDelta = -1;
    nextRisk = clamp(beforeRisk - 1, 0, 20);
    nextFailures = 0;
  } else {
    const delta = computeFailureDelta(errorClass);
    riskDelta = delta.riskDelta;
    failureDelta = delta.failureDelta;
    nextRisk = clamp(beforeRisk + delta.riskDelta, 0, 20);
    nextFailures = beforeFailures + delta.failureDelta;
  }

  let nextStatus = account.status;

  if (nextRisk >= 8 && account.status === "ACTIVE") {
    nextStatus = "RISKY";
  }

  if (nextRisk <= 3 && account.status === "RISKY") {
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
    consecutiveFailureDelta: failureDelta,
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
