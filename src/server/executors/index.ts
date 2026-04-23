import { WeiboExecutor } from "@/server/executors/weibo-executor";
import type { SocialExecutor } from "@/server/executors/types";

export function getExecutor(): SocialExecutor {
  return new WeiboExecutor();
}
