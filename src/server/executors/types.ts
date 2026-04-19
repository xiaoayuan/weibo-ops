export type ExecutorActionResult = {
  success: boolean;
  status: "READY" | "SUCCESS" | "FAILED";
  message: string;
  stage?: "PRECHECK_BLOCKED" | "PRECHECK_PASSED" | "ACTION_PENDING";
  responsePayload?: unknown;
};

export type ExecutePlanInput = {
  planId: string;
  accountId: string;
  accountNickname: string;
  accountLoginStatus: string;
  planType: "CHECK_IN" | "FIRST_COMMENT" | "POST" | "LIKE";
  targetUrl?: string | null;
  content?: string | null;
  topicName?: string | null;
  topicUrl?: string | null;
};

export type ExecuteInteractionInput = {
  interactionTaskId: string;
  accountId: string;
  accountNickname: string;
  accountLoginStatus: string;
  actionType: "CHECK_IN" | "FIRST_COMMENT" | "POST" | "LIKE";
  targetUrl: string;
  repostContent?: string | null;
};

export interface SocialExecutor {
  executePlan(input: ExecutePlanInput): Promise<ExecutorActionResult>;
  executeInteraction(input: ExecuteInteractionInput): Promise<ExecutorActionResult>;
}
