export type AccountLoginStatus = "UNKNOWN" | "ONLINE" | "EXPIRED" | "FAILED";

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
  accountLoginStatus: AccountLoginStatus;
  planType: "CHECK_IN" | "FIRST_COMMENT" | "POST" | "LIKE" | "COMMENT" | "REPOST";
  topicName: string;
  topicUrl: string;
  content?: string;
  mediaAssetUrl?: string;
  targetUrl?: string;
  retryCount?: number;
};

export type ExecuteInteractionInput = {
  interactionTaskId: string;
  accountId: string;
  accountNickname: string;
  accountLoginStatus: AccountLoginStatus;
  actionType: "CHECK_IN" | "FIRST_COMMENT" | "POST" | "LIKE" | "COMMENT" | "REPOST";
  targetUrl: string;
  repostContent?: string | null;
  commentText?: string | null;
  superTopicId?: string;
};

export interface SocialExecutor {
  executePlan(input: ExecutePlanInput): Promise<ExecutorActionResult>;
  executeInteraction(input: ExecuteInteractionInput): Promise<ExecutorActionResult>;
}
