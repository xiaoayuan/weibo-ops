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

export type CopywritingTemplate = {
  id: string;
  title: string;
  content: string;
  status: string;
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
