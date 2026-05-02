import { fetchServerApi } from "@/lib/backend";
import { getBusinessDateText } from "@/lib/date";

export type WeiboAccount = {
  id: string;
  nickname: string;
  remark: string | null;
  groupName: string | null;
  status: "ACTIVE" | "DISABLED" | "RISKY" | "EXPIRED";
  scheduleWindowEnabled: boolean;
  executionWindowStart: string | null;
  executionWindowEnd: string | null;
  baseJitterSec: number;
  loginStatus: "UNKNOWN" | "ONLINE" | "EXPIRED" | "FAILED";
  riskLevel: number;
  uid: string | null;
  username: string | null;
  cookieUpdatedAt: string | null;
  lastCheckAt: string | null;
  loginErrorMessage: string | null;
  consecutiveFailures: number;
  proxyNodeId: string | null;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  proxyNode?: {
    id: string;
    name: string;
    countryCode: string | null;
    rotationMode: string;
  } | null;
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
  error?: string | null;
  pendingReason?: string | null;
  scheduleNote?: string | null;
  contentId?: string | null;
  content: {
    id: string;
    title: string;
    content: string;
  } | null;
  account: {
    id: string;
    nickname: string;
    status: string;
    loginStatus: string;
    ownerUserId: string;
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
  requestPayload?: unknown;
  responsePayload?: unknown;
  plan?: {
    id: string;
    planType: string;
    scheduledTime: string;
  } | null;
  account: {
    id: string;
    nickname: string;
    status: string;
    loginStatus: string;
    ownerUserId: string;
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
  global: {
    key: string;
    nextAvailableAt: string | null;
    waitMs: number;
    active: boolean;
  } | null;
  taskTypes: Array<{
    key: string;
    taskType: string;
    nextAvailableAt: string | null;
    waitMs: number;
    active: boolean;
  }>;
  users: Array<{
    key: string;
    userId: string;
    username: string | null;
    nextAvailableAt: string | null;
    waitMs: number;
    active: boolean;
  }>;
  updatedAt: string;
};

export type TaskSchedulerStatus = {
  workerCount: number;
  workers: TaskSchedulerWorkerSnapshot[];
  rateLimit: TaskSchedulerRateLimit;
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
  actionType: "LIKE" | "POST" | "COMMENT" | "REPOST";
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
  maxAccounts: number;
  assignedAccounts?: number;
  enabled: boolean;
  username?: string | null;
  ip?: string;
  port: number;
  type?: string;
  location?: string;
  source?: string;
  latencyMs: number | null;
  successRate: number | null;
  lastCheckedAt: string | null;
  failures: number;
  disabled?: boolean;
  provider?: string;
};

export type InviteCode = {
  id: string;
  code: string;
  role: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  disabled: boolean;
  createdAt: string;
  creatorId: string;
  creator?: { id: string; username: string; nickname: string | null } | null;
  users?: Array<{ id: string; username: string; nickname: string | null; createdAt: string }>;
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

export type ExecutorHealth = {
  mode: string;
  executorClass: string;
  isRealExecutor: boolean;
  modeMatchesExecutor: boolean;
};

export type ProfileSettingsData = {
  id: string;
  username: string;
  role: "ADMIN" | "OPERATOR" | "VIEWER";
  proxyEnabled: boolean;
  proxyProtocol: "HTTP" | "HTTPS" | "SOCKS5";
  proxyHost: string;
  proxyPort: number;
  proxyUsername: string;
  proxyPasswordConfigured: boolean;
  taskConcurrency: number | null;
  autoGenerateEnabled: boolean | null;
  autoGenerateWindowStart: string | null;
  autoGenerateWindowEnd: string | null;
  autoExecuteEnabled: boolean | null;
  autoExecuteStartTime: string | null;
  autoExecuteEndTime: string | null;
};

export type AiCopywritingConfig = {
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  apiKeySource: "system" | "env" | "none";
};

export type AiRiskConfig = {
  riskyKeywords: string[];
};

export type ExecutionStrategy = {
  actionJob: {
    maxRetry: number;
    commentLikeConcurrency: { S: number; A: number; B: number };
    repostConcurrency: { S: number; A: number; B: number };
    urgency: {
      S: { waveRatios: [number, number, number]; waveWindowsSec: [number, number, number]; cooldownSecRange: [number, number]; retryDelaySecRange: [number, number]; targetSlaSec: number; limitSlaSec: number };
      A: { waveRatios: [number, number, number]; waveWindowsSec: [number, number, number]; cooldownSecRange: [number, number]; retryDelaySecRange: [number, number]; targetSlaSec: number; limitSlaSec: number };
      B: { waveRatios: [number, number, number]; waveWindowsSec: [number, number, number]; cooldownSecRange: [number, number]; retryDelaySecRange: [number, number]; targetSlaSec: number; limitSlaSec: number };
    };
  };
  circuitBreaker: {
    accountFailureThreshold: number;
    accountPauseMinutes: number;
    proxyWindowMinutes: number;
    proxyMinSamples: number;
    proxyFailureRatio: number;
    proxyPauseMinutes: number;
  };
};

export type RiskRules = {
  keywords: {
    targetIssue: string[];
    contentIssue: string[];
    transientNetwork: string[];
    platformBusy: string[];
    accountRisk: string[];
  };
  score: {
    success: number;
    targetIssue: number;
    contentIssue: number;
    transientNetwork: number;
    platformBusy: number;
    accountRisk: number;
    unknownFailure: number;
  };
  threshold: {
    markRiskyAt: number;
    recoverActiveAt: number;
    maxRiskLevel: number;
  };
};

export async function getAccounts() {
  const response = await fetchServerApi<WeiboAccount[]>("/api/accounts");

  if (!response.ok || !response.payload?.success) {
    return [] as WeiboAccount[];
  }

  return response.payload.data ?? [];
}

export async function getTodayPlans() {
  const response = await fetchServerApi<Plan[]>(`/api/plans?date=${getBusinessDateText()}`);

  if (!response.ok || !response.payload?.success) {
    return [] as Plan[];
  }

  return response.payload.data ?? [];
}

export async function getLogs() {
  const response = await fetchServerApi<ExecutionLog[]>("/api/logs");

  if (!response.ok || !response.payload?.success) {
    return [] as ExecutionLog[];
  }

  return response.payload.data ?? [];
}

export async function getTopicTasks() {
  const response = await fetchServerApi<TopicTask[]>("/api/topic-tasks");

  if (!response.ok || !response.payload?.success) {
    return [] as TopicTask[];
  }

  return response.payload.data ?? [];
}

export async function getCopywritingTemplates() {
  const response = await fetchServerApi<CopywritingTemplate[]>("/api/copywriting");

  if (!response.ok || !response.payload?.success) {
    return [] as CopywritingTemplate[];
  }

  return response.payload.data ?? [];
}

export async function getSuperTopics() {
  const response = await fetchServerApi<SuperTopic[]>("/api/super-topics");

  if (!response.ok || !response.payload?.success) {
    return [] as SuperTopic[];
  }

  return response.payload.data ?? [];
}

export async function getProxyBindings() {
  const response = await fetchServerApi<{ nodes: ProxyNode[]; accounts: ProxyBindingAccount[] }>("/api/proxy-bindings");

  if (!response.ok || !response.payload?.success) {
    return { nodes: [] as ProxyNode[], accounts: [] as ProxyBindingAccount[] };
  }

  return response.payload.data ?? { nodes: [], accounts: [] };
}

export async function getProxyNodes() {
  const response = await fetchServerApi<ProxyNode[]>("/api/proxy-nodes");

  if (!response.ok || !response.payload?.success) {
    return [] as ProxyNode[];
  }

  return response.payload.data ?? [];
}

export async function getUsers() {
  const response = await fetchServerApi<UserListItem[]>("/api/users");

  if (!response.ok || !response.payload?.success) {
    return [] as UserListItem[];
  }

  return response.payload.data ?? [];
}

export async function getInviteCodes() {
  const response = await fetchServerApi<InviteCode[]>("/api/invite-codes");

  if (!response.ok || !response.payload?.success) {
    return [] as InviteCode[];
  }

  return response.payload.data ?? [];
}

export async function getCommentPoolItems() {
  const response = await fetchServerApi<CommentPoolItem[]>("/api/comment-pool");

  if (!response.ok || !response.payload?.success) {
    return [] as CommentPoolItem[];
  }

  return response.payload.data ?? [];
}

export async function getActionJobs() {
  const response = await fetchServerApi<ActionJob[]>("/api/action-jobs");

  if (!response.ok || !response.payload?.success) {
    return [] as ActionJob[];
  }

  return response.payload.data ?? [];
}

export async function getTaskSchedulerStatus() {
  const response = await fetchServerApi<TaskSchedulerStatus>("/api/task-scheduler/status");

  if (!response.ok || !response.payload?.success) {
    return null;
  }

  return response.payload.data ?? null;
}

export async function getInteractionTasks() {
  const response = await fetchServerApi<InteractionTask[]>("/api/interaction-tasks");

  if (!response.ok || !response.payload?.success) {
    return [] as InteractionTask[];
  }

  return response.payload.data ?? [];
}

export async function getTrafficSummary() {
  const response = await fetchServerApi<TrafficSummary>("/api/traffic");

  if (!response.ok || !response.payload?.success) {
    return null;
  }

  return response.payload.data ?? null;
}

export async function getExecutionStrategy() {
  const response = await fetchServerApi<ExecutionStrategy>("/api/strategy-config");

  if (!response.ok || !response.payload?.success) {
    return null;
  }

  return response.payload.data ?? null;
}

export async function getRiskRules() {
  const response = await fetchServerApi<RiskRules>("/api/risk-rules");

  if (!response.ok || !response.payload?.success) {
    return null;
  }

  return response.payload.data ?? null;
}

export async function getProfileSettings() {
  const response = await fetchServerApi<ProfileSettingsData>("/api/auth/profile");

  if (!response.ok || !response.payload?.success) {
    return null;
  }

  return response.payload.data ?? null;
}

export async function getExecutorHealth() {
  const response = await fetchServerApi<ExecutorHealth>("/api/health/executor");

  if (!response.ok || !response.payload?.success) {
    return null;
  }

  return response.payload.data ?? null;
}

export async function getAiCopywritingConfig() {
  const response = await fetchServerApi<AiCopywritingConfig>("/api/copywriting/ai-config");

  if (!response.ok || !response.payload?.success) {
    return null;
  }

  return response.payload.data ?? null;
}

export async function getAiRiskConfig() {
  const response = await fetchServerApi<AiRiskConfig>("/api/ai-risk/config");

  if (!response.ok || !response.payload?.success) {
    return null;
  }

  return response.payload.data ?? null;
}
