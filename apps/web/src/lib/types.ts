/**
 * 通用 API 响应类型
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    [key: string]: unknown;
  };
}

/**
 * 分页响应类型
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 账号状态
 */
export type AccountStatus = "ACTIVE" | "DISABLED" | "RISKY" | "EXPIRED";

/**
 * 登录状态
 */
export type LoginStatus = "UNKNOWN" | "ONLINE" | "EXPIRED" | "FAILED";

/**
 * 用户角色
 */
export type UserRole = "ADMIN" | "OPERATOR" | "VIEWER";

/**
 * 计划状态
 */
export type PlanStatus = "PENDING" | "READY" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED" | "PARTIAL_FAILED";

/**
 * 任务类型
 */
export type TaskType = "CHECK_IN" | "FIRST_COMMENT" | "POST" | "REPOST" | "COMMENT" | "LIKE";

/**
 * 互动任务状态
 */
export type InteractionStatus = "PENDING" | "READY" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";

/**
 * 互动动作类型
 */
export type InteractionActionType = "LIKE" | "POST" | "COMMENT" | "REPOST";

/**
 * 编排任务类型
 */
export type ActionJobType = "COMMENT_LIKE_BATCH" | "REPOST_ROTATION";

/**
 * 编排任务状态
 */
export type ActionJobStatus = "PENDING" | "RUNNING" | "SUCCESS" | "PARTIAL_FAILED" | "FAILED" | "CANCELLED";

/**
 * 代理协议
 */
export type ProxyProtocol = "HTTP" | "HTTPS" | "SOCKS5";

/**
 * 代理轮换模式
 */
export type ProxyRotationMode = "STICKY" | "M1" | "M5" | "M10";

/**
 * 微博账号
 */
export interface WeiboAccount {
  id: string;
  nickname: string;
  weiboUid: string;
  status: AccountStatus;
  loginStatus: LoginStatus;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
  ownerUserId: string;
}

/**
 * 用户
 */
export interface User {
  id: string;
  username: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

/**
 * 超话
 */
export interface SuperTopic {
  id: string;
  name: string;
  topicId: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 超话任务
 */
export interface TopicTask {
  id: string;
  superTopicId: string;
  taskType: TaskType;
  scheduledTime: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  superTopic: SuperTopic;
}

/**
 * 文案模板
 */
export interface CopywritingTemplate {
  id: string;
  title: string;
  content: string;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 每日计划
 */
export interface DailyPlan {
  id: string;
  accountId: string;
  taskId: string;
  contentId: string | null;
  businessDate: string;
  scheduledTime: string;
  status: PlanStatus;
  resultMessage: string | null;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
  account: WeiboAccount;
  task: TopicTask;
  content: CopywritingTemplate | null;
}

/**
 * 互动目标
 */
export interface InteractionTarget {
  id: string;
  targetUrl: string;
  targetType: string;
  targetId: string;
  createdAt: string;
}

/**
 * 互动任务
 */
export interface InteractionTask {
  id: string;
  accountId: string;
  targetId: string;
  contentId: string | null;
  actionType: InteractionActionType;
  scheduledTime: string;
  status: InteractionStatus;
  resultMessage: string | null;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
  account: WeiboAccount;
  target: InteractionTarget;
  content: CopywritingTemplate | null;
}

/**
 * 执行日志
 */
export interface ExecutionLog {
  id: string;
  accountId: string | null;
  planId: string | null;
  interactionTaskId: string | null;
  actionType: string;
  requestPayload: unknown;
  responsePayload: unknown;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
  account?: WeiboAccount;
  plan?: DailyPlan;
  interactionTask?: InteractionTask;
}

/**
 * 编排任务账号运行记录
 */
export interface ActionJobAccountRun {
  id: string;
  jobId: string;
  accountId: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  status: ActionJobStatus;
  startedAt: string | null;
  completedAt: string | null;
  account: WeiboAccount;
}

/**
 * 编排任务
 */
export interface ActionJob {
  id: string;
  jobType: ActionJobType;
  config: Record<string, unknown>;
  status: ActionJobStatus;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  accountRuns: ActionJobAccountRun[];
}

/**
 * 代理节点
 */
export interface ProxyNode {
  id: string;
  label: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  country: string | null;
  rotationMode: ProxyRotationMode;
  maxAccounts: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 代理绑定
 */
export interface ProxyBinding {
  id: string;
  accountId: string;
  primaryProxyId: string | null;
  backup1ProxyId: string | null;
  backup2ProxyId: string | null;
  bindingMode: "AUTO" | "MANUAL";
  allowHostFallback: boolean;
  createdAt: string;
  updatedAt: string;
  account: WeiboAccount;
  primaryProxy: ProxyNode | null;
  backup1Proxy: ProxyNode | null;
  backup2Proxy: ProxyNode | null;
}

/**
 * 评论池项
 */
export interface CommentPoolItem {
  id: string;
  content: string;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 邀请码
 */
export interface InviteCode {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * 类型守卫
 */
export function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof value.success === "boolean"
  );
}

export function isPaginatedResponse<T>(value: unknown): value is PaginatedResponse<T> {
  return (
    isApiResponse(value) &&
    "meta" in value &&
    typeof value.meta === "object" &&
    "page" in value.meta &&
    "pageSize" in value.meta &&
    "total" in value.meta
  );
}

/**
 * 类型断言辅助函数
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}

/**
 * 安全的 JSON 解析
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * 类型安全的对象键
 */
export function typedKeys<T extends object>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>;
}

/**
 * 类型安全的对象条目
 */
export function typedEntries<T extends object>(
  obj: T
): Array<[keyof T, T[keyof T]]> {
  return Object.entries(obj) as Array<[keyof T, T[keyof T]]>;
}
