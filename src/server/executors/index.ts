import { MockExecutor } from "@/server/executors/mock-executor";
import { WeiboExecutor } from "@/server/executors/weibo-executor";
import type { SocialExecutor } from "@/server/executors/types";

export function getExecutor(): SocialExecutor {
  if (process.env.EXECUTOR_MODE === "weibo") {
    return new WeiboExecutor();
  }

  return new MockExecutor();
}
