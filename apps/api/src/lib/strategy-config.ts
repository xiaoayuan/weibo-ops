import { z } from "zod";

import { prisma } from "@/src/lib/prisma";

const settingKey = "execution_strategy_v1";

const urgencyRuleSchema = z.object({
  waveRatios: z.tuple([z.number().min(0.05).max(0.9), z.number().min(0.05).max(0.9), z.number().min(0.05).max(0.9)]),
  waveWindowsSec: z.tuple([z.number().int().min(30), z.number().int().min(60), z.number().int().min(120)]),
  cooldownSecRange: z.tuple([z.number().int().min(1), z.number().int().min(3600)]),
  retryDelaySecRange: z.tuple([z.number().int().min(1), z.number().int().min(3600)]),
  targetSlaSec: z.number().int().min(60).max(86_400),
  limitSlaSec: z.number().int().min(60).max(86_400),
});

export const executionStrategySchema = z.object({
  actionJob: z.object({
    maxRetry: z.number().int().min(0).max(3),
    commentLikeConcurrency: z.object({ S: z.number().int().min(1).max(100), A: z.number().int().min(1).max(100), B: z.number().int().min(1).max(100) }),
    repostConcurrency: z.object({ S: z.number().int().min(1).max(100), A: z.number().int().min(1).max(100), B: z.number().int().min(1).max(100) }),
    urgency: z.object({ S: urgencyRuleSchema, A: urgencyRuleSchema, B: urgencyRuleSchema }),
  }),
  circuitBreaker: z.object({
    accountFailureThreshold: z.number().int().min(1).max(20),
    accountPauseMinutes: z.number().int().min(1).max(24 * 60),
    proxyWindowMinutes: z.number().int().min(1).max(120),
    proxyMinSamples: z.number().int().min(1).max(500),
    proxyFailureRatio: z.number().min(0.05).max(1),
    proxyPauseMinutes: z.number().int().min(1).max(24 * 60),
  }),
});

export type ExecutionStrategy = z.infer<typeof executionStrategySchema>;

export const defaultExecutionStrategy: ExecutionStrategy = {
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
  circuitBreaker: { accountFailureThreshold: 3, accountPauseMinutes: 360, proxyWindowMinutes: 10, proxyMinSamples: 10, proxyFailureRatio: 0.4, proxyPauseMinutes: 30 },
};

let cachedStrategy: ExecutionStrategy | null = null;
let cachedAt = 0;

function normalizeStrategy(strategy: ExecutionStrategy): ExecutionStrategy {
  const normalizeUrgency = (item: ExecutionStrategy["actionJob"]["urgency"]["S"]) => {
    const sum = item.waveRatios[0] + item.waveRatios[1] + item.waveRatios[2];
    const normalized = sum > 0 ? item.waveRatios.map((value) => value / sum) : [1 / 3, 1 / 3, 1 / 3];

    return {
      ...item,
      waveRatios: [normalized[0], normalized[1], normalized[2]] as [number, number, number],
      waveWindowsSec: [item.waveWindowsSec[0], Math.max(item.waveWindowsSec[0], item.waveWindowsSec[1]), Math.max(item.waveWindowsSec[1], item.waveWindowsSec[2])] as [number, number, number],
      cooldownSecRange: [Math.min(item.cooldownSecRange[0], item.cooldownSecRange[1]), Math.max(item.cooldownSecRange[0], item.cooldownSecRange[1])] as [number, number],
      retryDelaySecRange: [Math.min(item.retryDelaySecRange[0], item.retryDelaySecRange[1]), Math.max(item.retryDelaySecRange[0], item.retryDelaySecRange[1])] as [number, number],
      limitSlaSec: Math.max(item.targetSlaSec, item.limitSlaSec),
    };
  };

  return {
    actionJob: {
      maxRetry: strategy.actionJob.maxRetry,
      commentLikeConcurrency: { ...strategy.actionJob.commentLikeConcurrency },
      repostConcurrency: { ...strategy.actionJob.repostConcurrency },
      urgency: {
        S: normalizeUrgency(strategy.actionJob.urgency.S),
        A: normalizeUrgency(strategy.actionJob.urgency.A),
        B: normalizeUrgency(strategy.actionJob.urgency.B),
      },
    },
    circuitBreaker: strategy.circuitBreaker,
  };
}

export async function getExecutionStrategy() {
  const now = Date.now();
  if (cachedStrategy && now - cachedAt < 60_000) {
    return cachedStrategy;
  }

  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: settingKey } });
    if (!setting) {
      cachedStrategy = normalizeStrategy(defaultExecutionStrategy);
      cachedAt = now;
      return cachedStrategy;
    }

    const parsed = executionStrategySchema.safeParse(setting.value);
    if (!parsed.success) {
      cachedStrategy = normalizeStrategy(defaultExecutionStrategy);
      cachedAt = now;
      return cachedStrategy;
    }

    cachedStrategy = normalizeStrategy(parsed.data);
    cachedAt = now;
    return cachedStrategy;
  } catch {
    cachedStrategy = normalizeStrategy(defaultExecutionStrategy);
    cachedAt = now;
    return cachedStrategy;
  }
}

export async function saveExecutionStrategy(nextStrategy: ExecutionStrategy) {
  const normalized = normalizeStrategy(nextStrategy);
  await prisma.systemSetting.upsert({
    where: { key: settingKey },
    create: { key: settingKey, value: normalized },
    update: { value: normalized },
  });
  cachedStrategy = normalized;
  cachedAt = Date.now();
  return normalized;
}
