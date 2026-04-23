import { prisma } from "@/lib/prisma";
import { getExecutionStrategy } from "@/server/strategy/config";

type AccountCircuitState = {
  consecutiveFailures?: number;
  pausedUntil?: string;
};

type ProxyCircuitState = {
  windowStartedAt?: string;
  total?: number;
  failed?: number;
  pausedUntil?: string;
};

function accountKey(accountId: string) {
  return `risk:circuit:account:${accountId}`;
}

function proxyKey(proxyNodeId: string) {
  return `risk:circuit:proxy:${proxyNodeId}`;
}

function parseDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

async function getSettingValue<T>(key: string): Promise<T | undefined> {
  const setting = await prisma.systemSetting.findUnique({ where: { key }, select: { value: true } });

  if (!setting?.value || typeof setting.value !== "object") {
    return undefined;
  }

  return setting.value as T;
}

async function upsertSettingValue(key: string, value: unknown) {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: value as never },
    create: { key, value: value as never },
  });
}

export async function isAccountCircuitOpen(accountId?: string | null) {
  if (!accountId) {
    return false;
  }

  const state = await getSettingValue<AccountCircuitState>(accountKey(accountId));
  const pausedUntil = parseDate(state?.pausedUntil);

  return Boolean(pausedUntil && pausedUntil.getTime() > Date.now());
}

export async function isProxyCircuitOpen(proxyNodeId?: string | null) {
  if (!proxyNodeId) {
    return false;
  }

  const state = await getSettingValue<ProxyCircuitState>(proxyKey(proxyNodeId));
  const pausedUntil = parseDate(state?.pausedUntil);

  return Boolean(pausedUntil && pausedUntil.getTime() > Date.now());
}

export async function recordExecutionOutcome(input: {
  accountId?: string | null;
  proxyNodeId?: string | null;
  success: boolean;
}) {
  const strategy = await getExecutionStrategy();
  const accountFailureThreshold = strategy.circuitBreaker.accountFailureThreshold;
  const accountPauseMs = strategy.circuitBreaker.accountPauseMinutes * 60 * 1000;
  const proxyWindowMs = strategy.circuitBreaker.proxyWindowMinutes * 60 * 1000;
  const proxyMinSamples = strategy.circuitBreaker.proxyMinSamples;
  const proxyFailureRatio = strategy.circuitBreaker.proxyFailureRatio;
  const proxyPauseMs = strategy.circuitBreaker.proxyPauseMinutes * 60 * 1000;
  const now = Date.now();

  if (input.accountId) {
    const key = accountKey(input.accountId);
    const current = (await getSettingValue<AccountCircuitState>(key)) || {};
    const pausedUntil = parseDate(current.pausedUntil);
    const pausedActive = Boolean(pausedUntil && pausedUntil.getTime() > now);

    if (input.success) {
      await upsertSettingValue(key, {
        consecutiveFailures: 0,
        pausedUntil: pausedActive ? pausedUntil?.toISOString() : undefined,
      });
    } else {
      const consecutiveFailures = (current.consecutiveFailures || 0) + 1;
      const nextPausedUntil =
        consecutiveFailures >= accountFailureThreshold
          ? new Date(now + accountPauseMs).toISOString()
          : pausedActive
            ? pausedUntil?.toISOString()
            : undefined;

      await upsertSettingValue(key, {
        consecutiveFailures,
        pausedUntil: nextPausedUntil,
      });
    }
  }

  if (input.proxyNodeId) {
    const key = proxyKey(input.proxyNodeId);
    const current = (await getSettingValue<ProxyCircuitState>(key)) || {};
    const pausedUntil = parseDate(current.pausedUntil);
    const pausedActive = Boolean(pausedUntil && pausedUntil.getTime() > now);
    const windowStartedAt = parseDate(current.windowStartedAt);
    const shouldResetWindow = !windowStartedAt || now - windowStartedAt.getTime() > proxyWindowMs;

    const total = (shouldResetWindow ? 0 : current.total || 0) + 1;
    const failed = (shouldResetWindow ? 0 : current.failed || 0) + (input.success ? 0 : 1);
    const failureRatio = total > 0 ? failed / total : 0;

    const nextPausedUntil =
      total >= proxyMinSamples && failureRatio > proxyFailureRatio
        ? new Date(now + proxyPauseMs).toISOString()
        : pausedActive
          ? pausedUntil?.toISOString()
          : undefined;

    await upsertSettingValue(key, {
      windowStartedAt: shouldResetWindow ? new Date(now).toISOString() : windowStartedAt?.toISOString(),
      total,
      failed,
      pausedUntil: nextPausedUntil,
    });
  }
}
