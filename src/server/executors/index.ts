import { MockExecutor } from "@/server/executors/mock-executor";
import type { SocialExecutor } from "@/server/executors/types";

export function getExecutor(): SocialExecutor {
  return new MockExecutor();
}
