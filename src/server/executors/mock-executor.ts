import type { ExecuteInteractionInput, ExecutePlanInput, ExecutorActionResult, SocialExecutor } from "@/server/executors/types";

export class MockExecutor implements SocialExecutor {
  async executePlan(input: ExecutePlanInput): Promise<ExecutorActionResult> {
    return {
      success: true,
      status: "READY",
      message: `Mock executor 已接收 ${input.accountNickname} 的 ${input.planType} 计划，当前仅完成执行预检。`,
      responsePayload: {
        executor: "mock",
        topicName: input.topicName,
        targetUrl: input.targetUrl,
        hasContent: Boolean(input.content),
      },
    };
  }

  async executeInteraction(input: ExecuteInteractionInput): Promise<ExecutorActionResult> {
    return {
      success: true,
      status: "READY",
      message: `Mock executor 已接收 ${input.accountNickname} 的 ${input.actionType} 互动任务，当前仅完成执行预检。`,
      responsePayload: {
        executor: "mock",
        targetUrl: input.targetUrl,
      },
    };
  }
}
