import { WeiboExecutor } from "@/server/executors/weibo-executor";
import type { SocialExecutor } from "@/server/executors/types";

export type ExecutorHealthStatus = {
  mode: string;
  executorClass: string;
  isRealExecutor: boolean;
  modeMatchesExecutor: boolean;
};

export function getExecutor(): SocialExecutor {
  return new WeiboExecutor();
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
