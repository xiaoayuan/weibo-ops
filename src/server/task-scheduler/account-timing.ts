type AccountTimingConfig = {
  scheduleWindowEnabled: boolean;
  executionWindowStart: string | null;
  executionWindowEnd: string | null;
  baseJitterSec: number;
};

type AccountTimingResult = {
  windowEnabled: boolean;
  windowStart: string | null;
  windowEnd: string | null;
  waitMs: number;
  jitterMs: number;
  reason: "WINDOW_WAIT" | "JITTER" | "WINDOW_AND_JITTER" | "NONE";
};

function parseMinutes(timeText: string | null) {
  if (!timeText) {
    return null;
  }

  const matched = timeText.match(/^(\d{2}):(\d{2})$/);

  if (!matched) {
    return null;
  }

  return Number(matched[1]) * 60 + Number(matched[2]);
}

function getShanghaiMinutes(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);

  return hour * 60 + minute;
}

function stableHash(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function getAccountTimingDecision(accountId: string, taskLabel: string, config: AccountTimingConfig): AccountTimingResult {
  const startMinutes = parseMinutes(config.executionWindowStart);
  const endMinutes = parseMinutes(config.executionWindowEnd);
  const nowMinutes = getShanghaiMinutes();

  let waitMs = 0;

  if (config.scheduleWindowEnabled && startMinutes !== null && endMinutes !== null && nowMinutes < startMinutes) {
    waitMs = (startMinutes - nowMinutes) * 60 * 1000;
  }

  const jitterBase = Math.max(0, config.baseJitterSec || 0);
  const jitterMs = jitterBase > 0 ? (stableHash(`${accountId}:${taskLabel}`) % (jitterBase + 1)) * 1000 : 0;

  if (waitMs > 0 && jitterMs > 0) {
    return {
      windowEnabled: config.scheduleWindowEnabled,
      windowStart: config.executionWindowStart,
      windowEnd: config.executionWindowEnd,
      waitMs: waitMs + jitterMs,
      jitterMs,
      reason: "WINDOW_AND_JITTER",
    };
  }

  if (waitMs > 0) {
    return {
      windowEnabled: config.scheduleWindowEnabled,
      windowStart: config.executionWindowStart,
      windowEnd: config.executionWindowEnd,
      waitMs,
      jitterMs: 0,
      reason: "WINDOW_WAIT",
    };
  }

  if (jitterMs > 0) {
    return {
      windowEnabled: config.scheduleWindowEnabled,
      windowStart: config.executionWindowStart,
      windowEnd: config.executionWindowEnd,
      waitMs: jitterMs,
      jitterMs,
      reason: "JITTER",
    };
  }

  return {
    windowEnabled: config.scheduleWindowEnabled,
    windowStart: config.executionWindowStart,
    windowEnd: config.executionWindowEnd,
    waitMs: 0,
    jitterMs: 0,
    reason: "NONE",
  };
}

export async function waitForAccountExecutionWindow(accountId: string, taskLabel: string, config: AccountTimingConfig) {
  const decision = getAccountTimingDecision(accountId, taskLabel, config);

  if (decision.waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, decision.waitMs));
  }

  return decision;
}
