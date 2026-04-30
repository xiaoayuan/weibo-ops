import { fetchServerApi } from "@/lib/backend";
import { getBusinessDateText } from "@/lib/date";

export type WeiboAccount = {
  id: string;
  nickname: string;
  remark: string | null;
  groupName: string | null;
  status: "ACTIVE" | "DISABLED" | "RISKY" | "EXPIRED";
  loginStatus: "UNKNOWN" | "ONLINE" | "EXPIRED" | "FAILED";
  loginErrorMessage: string | null;
  lastCheckAt: string | null;
  cookieUpdatedAt: string | null;
  proxyNodeId: string | null;
  username: string | null;
  uid: string | null;
  consecutiveFailures: number;
};

export type TopicTask = {
  id: string;
  accountId: string;
  superTopicId: string;
  signEnabled: boolean;
  firstCommentEnabled: boolean;
  firstCommentPerDay: number;
  firstCommentIntervalSec: number;
  likePerDay: number;
  likeIntervalSec: number;
  repostPerDay: number;
  repostIntervalSec: number;
  commentPerDay: number;
  commentIntervalSec: number;
  postEnabled: boolean;
  minPostsPerDay: number;
  maxPostsPerDay: number;
  startTime: string | null;
  endTime: string | null;
  status: boolean;
  account: {
    id: string;
    nickname: string;
    groupName: string | null;
  };
  superTopic: {
    id: string;
    name: string;
    boardName: string | null;
    topicUrl: string | null;
  };
};

export type Plan = {
  id: string;
  accountId: string;
  createdAt: string;
  planDate: string;
  planType: string;
  scheduledTime: string;
  status: string;
  resultMessage: string | null;
  pendingReason?: string | null;
  scheduleNote?: string | null;
  contentId?: string | null;
  content: {
    id: string;
    title: string;
    content: string;
  } | null;
  account: {
    nickname: string;
  };
  task: {
    superTopic: {
      name: string;
    } | null;
  } | null;
};

export type ExecutionLog = {
  id: string;
  actionType: string;
  success: boolean;
  errorMessage: string | null;
  executedAt: string;
  account: {
    nickname: string;
  } | null;
};

export type CommentPoolItem = {
  id: string;
  sourceUrl: string;
  commentId: string;
  note: string | null;
  tags: string[];
  isForcedDuplicate: boolean;
  createdAt?: string;
};

export type ActionJobAccountRun = {
  id: string;
  accountId: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  errorMessage: string | null;
  account: {
    id: string;
    nickname: string;
  };
};

export type ActionJob = {
  id: string;
  jobType: "COMMENT_LIKE_BATCH" | "REPOST_ROTATION";
  status: "PENDING" | "RUNNING" | "SUCCESS" | "PARTIAL_FAILED" | "FAILED" | "CANCELLED";
  createdAt: string;
  createdBy: string | null;
  config: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  accountRuns: ActionJobAccountRun[];
};

export type TaskSchedulerQueueSnapshot = {
  userId: string;
  username: string | null;
  taskConcurrency: number;
  pendingCount: number;
  runningCount: number;
  pendingLabels: string[];
  runningLabels: string[];
};

export type TaskSchedulerWorkerSnapshot = {
  workerId: string;
  queueCount: number;
  users: TaskSchedulerQueueSnapshot[];
};

export type TaskSchedulerRateLimit = {
  ownerUserId: string;
  taskType: string;
  effectiveTier: string;
  earliestStartAt: string;
  delayMs: number;
  reasons: string[];
};

export type TaskSchedulerStatus = {
  workerCount: number;
  workers: TaskSchedulerWorkerSnapshot[];
  rateLimit: TaskSchedulerRateLimit[];
  updatedAt: string;
};

export type InteractionTarget = {
  id: string;
  targetUrl: string;
  targetType: string;
  parsedTargetId: string | null;
  status: string;
};

export type InteractionTask = {
  id: string;
  actionType: "LIKE" | "POST" | "COMMENT";
  status: "PENDING" | "READY" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
  resultMessage: string | null;
  createdAt: string;
  isOwned: boolean;
  account: {
    id: string;
    nickname: string;
  };
  target: InteractionTarget;
  content: CopywritingTemplate | null;
};

export type TrafficActionRow = {
  actionKey: string;
  logCount: number;
  bytes: bigint | number | string;
};

export type TrafficDailyRow = {
  day: string;
  bytes: bigint | number | string;
};

export type TrafficRecentRow = {
  id: string;
  accountNickname: string;
  actionKey: string;
  executedAt: string;
  bytes: bigint | number | string;
};

export type TrafficSummary = {
  oneDayBytes: bigint | number | string;
  sevenDayBytes: bigint | number | string;
  thirtyDayBytes: bigint | number | string;
  actionRows: TrafficActionRow[];
  dailyRows: TrafficDailyRow[];
  recentRows: TrafficRecentRow[];
};

export type CopywritingTemplate = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SuperTopic = {
  id: string;
  name: string;
  boardName: string | null;
  topicUrl: string | null;
};

export type ProxyNode = {
  id: string;
  name: string;
  protocol: "HTTP" | "HTTPS" | "SOCKS5";
  rotationMode: "STICKY" | "M1" | "M5" | "M10";
  countryCode: string | null;
  host: string;
  port: number;
  username?: string | null;
  enabled: boolean;
  maxAccounts?: number;
  assignedAccounts: number;
  hasPassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ProxyBindingAccount = {
  id: string;
  nickname: string;
  groupName: string | null;
  status: "ACTIVE" | "DISABLED" | "RISKY" | "EXPIRED";
  proxyNodeId: string | null;
  backupProxyNodeId: string | null;
  fallbackProxyNodeId: string | null;
  proxyBindingMode: "AUTO" | "MANUAL";
  proxyBindingLocked: boolean;
  allowHostFallback: boolean;
};

export type UserListItem = {
  id: string;
  username: string;
  role: "ADMIN" | "OPERATOR" | "VIEWER";
  createdAt: string;
  updatedAt: string;
};

export type InviteCode = {
  id: string;
  code: string;
  role: "VIEWER" | "OPERATOR";
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  disabled: boolean;
  createdAt: string;
};

export async function getAccounts() {
  const response = await fetchServerApi<WeiboAccount[]>("/api/accounts");

  if (!response.ok || !response.payload?.success) {
    return [];
  }

  return response.payload.data;
}

export async function getTodayPlans() {
  const response = await fetchServerApi<Plan[]>(`/api/plans?date=${getBusinessDateText()}`);

  if (!response.ok || !response.payload?.success) {
    return [];
  }

  return response.payload.data;
}

export async function getLogs() {
  const response = await fetchServerApi<ExecutionLog[]>("/api/logs");

  if (!response.ok || !response.payload?.success) {
    return [];
  }

  return response.payload.data;
}

export async function getTopicTasks() {
  const response = await fetchServerApi<TopicTask[]>("/api/topic-tasks");

  if (!response.ok || !response.payload?.success) {
    return [];
  }

  return response.payload.data;
}

export async function getCopywritingTemplates() {
  const response = await fetchServerApi<CopywritingTemplate[]>("/api/copywriting");

  if (!response.ok || !response.payload?.success) {
    return [];
  }

  return response.payload.data;
}

export async function getSuperTopics() {
  const response = await fetchServerApi<SuperTopic[]>("/api/super-topics");

  if (!response.ok || !response.payload?.success) {
    return [];
  }

  return response.payload.data;
}

export async function getProxyBindings() {
  const response = await fetchServerApi<{ nodes: ProxyNode[]; accounts: ProxyBindingAccount[] }>("/api/proxy-bindings");

  if (!response.ok || !response.payload?.success) {
    return { nodes: [], accounts: [] };
  }

  return response.payload.data;
}

export async function getProxyNodes() {
  const response = await fetchServerApi<ProxyNode[]>("/api/proxy-nodes");

  if (!response.ok || !response.payload?.success) {
    return [];
  }

  return response.payload.data;
}

export async function getUsers() {
  const response = await fetchServerApi<UserListItem[]>("/api/users");

  if (!response.ok || !response.payload?.success) {
    return [];
  }

  return response.payload.data;
}

export async function getInviteCodes() {
  const response = await fetchServerApi<InviteCode[]>("/api/invite-codes");

  if (!response.ok || !response.payload?.success) {
    return [];
  }

  return response.payload.data;
}

export async function getCommentPoolItems() {
  const response = await fetchServerApi<CommentPoolItem[]>("/api/comment-pool");

  if (!response.ok || !response.payload?.success) {
    return [];
  }

  return response.payload.data;
}

export async function getActionJobs() {
  const response = await fetchServerApi<ActionJob[]>("/api/action-jobs");

  if (!response.ok || !response.payload?.success) {
    return [];
  }

  return response.payload.data;
}

export async function getTaskSchedulerStatus() {
  const response = await fetchServerApi<TaskSchedulerStatus>("/api/task-scheduler/status");

  if (!response.ok || !response.payload?.success) {
    return null;
  }

  return response.payload.data;
}

export async function getInteractionTasks() {
  const response = await fetchServerApi<InteractionTask[]>("/api/interaction-tasks");

  if (!response.ok || !response.payload?.success) {
    return [];
  }

  return response.payload.data;
}

export async function getTrafficSummary() {
  const response = await fetchServerApi<TrafficSummary>("/api/traffic");

  if (!response.ok || !response.payload?.success) {
    return null;
  }

  return response.payload.data;
}
