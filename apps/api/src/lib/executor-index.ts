import { MockExecutor } from "@/src/lib/mock-executor";
import type { SocialExecutor } from "@/src/lib/executor-types";
import { WeiboExecutor } from "@/src/lib/weibo-executor";

export type ExecutorHealthStatus = {
  mode: string;
  executorClass: string;
  isRealExecutor: boolean;
  modeMatchesExecutor: boolean;
};

export function getExecutor(): SocialExecutor {
  const mode = (process.env.EXECUTOR_MODE || "weibo").toLowerCase();
  return mode === "weibo" ? new WeiboExecutor() : new MockExecutor();
}

export function getExecutorHealthStatus(): ExecutorHealthStatus {
  const mode = (process.env.EXECUTOR_MODE || "weibo").toLowerCase();
  const executor = getExecutor();
  const executorClass = executor.constructor?.name || "UnknownExecutor";
  const isRealExecutor = executor instanceof WeiboExecutor;

  return {
    mode,
    executorClass,
    isRealExecutor,
    modeMatchesExecutor: (mode === "weibo") === isRealExecutor,
  };
}
