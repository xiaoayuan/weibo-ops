import type { ApiResponse } from "./types";

/**
 * 错误码枚举
 */
export enum ErrorCode {
  // 认证相关
  UNAUTHORIZED = "UNAUTHORIZED",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  FORBIDDEN = "FORBIDDEN",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",

  // 资源相关
  NOT_FOUND = "NOT_FOUND",
  ALREADY_EXISTS = "ALREADY_EXISTS",
  RESOURCE_LOCKED = "RESOURCE_LOCKED",

  // 验证相关
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",

  // 业务逻辑
  ACCOUNT_OFFLINE = "ACCOUNT_OFFLINE",
  ACCOUNT_DISABLED = "ACCOUNT_DISABLED",
  TASK_RUNNING = "TASK_RUNNING",
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  OPERATION_FAILED = "OPERATION_FAILED",

  // 系统错误
  NETWORK_ERROR = "NETWORK_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  TIMEOUT = "TIMEOUT",

  // 未知错误
  UNKNOWN = "UNKNOWN",
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  meta?: Record<string, unknown>
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    meta,
  };
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  message: string,
  code: ErrorCode = ErrorCode.UNKNOWN,
  meta?: Record<string, unknown>
): ApiResponse<never> {
  return {
    success: false,
    message,
    code,
    meta,
  };
}

/**
 * 创建分页响应
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number,
  message?: string
): ApiResponse<T[]> {
  return {
    success: true,
    data,
    message,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * 处理 API 错误
 */
export function handleApiError(error: unknown): ApiResponse<never> {
  if (error instanceof Error) {
    // 根据错误消息判断错误码
    const message = error.message.toLowerCase();

    if (message.includes("unauthorized") || message.includes("未登录")) {
      return createErrorResponse(error.message, ErrorCode.UNAUTHORIZED);
    }
    if (message.includes("forbidden") || message.includes("权限")) {
      return createErrorResponse(error.message, ErrorCode.FORBIDDEN);
    }
    if (message.includes("not found") || message.includes("不存在")) {
      return createErrorResponse(error.message, ErrorCode.NOT_FOUND);
    }
    if (message.includes("already exists") || message.includes("已存在")) {
      return createErrorResponse(error.message, ErrorCode.ALREADY_EXISTS);
    }
    if (message.includes("validation") || message.includes("验证")) {
      return createErrorResponse(error.message, ErrorCode.VALIDATION_ERROR);
    }
    if (message.includes("offline") || message.includes("过期")) {
      return createErrorResponse(error.message, ErrorCode.ACCOUNT_OFFLINE);
    }
    if (message.includes("disabled") || message.includes("停用")) {
      return createErrorResponse(error.message, ErrorCode.ACCOUNT_DISABLED);
    }
    if (message.includes("running") || message.includes("执行中")) {
      return createErrorResponse(error.message, ErrorCode.TASK_RUNNING);
    }
    if (message.includes("network") || message.includes("网络")) {
      return createErrorResponse(error.message, ErrorCode.NETWORK_ERROR);
    }
    if (message.includes("timeout") || message.includes("超时")) {
      return createErrorResponse(error.message, ErrorCode.TIMEOUT);
    }
    if (message.includes("database") || message.includes("数据库")) {
      return createErrorResponse(error.message, ErrorCode.DATABASE_ERROR);
    }

    return createErrorResponse(error.message, ErrorCode.OPERATION_FAILED);
  }

  if (typeof error === "string") {
    return createErrorResponse(error, ErrorCode.OPERATION_FAILED);
  }

  return createErrorResponse("发生了未知错误", ErrorCode.UNKNOWN);
}

/**
 * 验证 API 响应
 */
export function validateApiResponse<T>(response: unknown): response is ApiResponse<T> {
  return (
    typeof response === "object" &&
    response !== null &&
    "success" in response &&
    typeof response.success === "boolean"
  );
}

/**
 * 提取 API 数据
 */
export function extractApiData<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw new Error(response.message || "API 请求失败");
  }

  if (response.data === undefined) {
    throw new Error("API 响应缺少数据");
  }

  return response.data;
}

/**
 * 安全提取 API 数据
 */
export function safeExtractApiData<T>(
  response: ApiResponse<T>,
  fallback: T
): T {
  try {
    return extractApiData(response);
  } catch {
    return fallback;
  }
}
