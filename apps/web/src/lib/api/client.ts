import { performanceMonitor } from "../performance-monitor";

/**
 * 统一的 API 响应格式
 */
export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  cached?: boolean; // 是否来自缓存
};

/**
 * 统一的 API 错误类
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * 发送 API 请求的统一方法
 */
export async function apiRequest<T = unknown>(
  url: string,
  options?: RequestInit & { signal?: AbortSignal }
): Promise<T> {
  return performanceMonitor.measure(
    `API:${options?.method || "GET"} ${url}`,
    async () => {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            ...options?.headers,
          },
        });

        const result: ApiResponse<T> = await response.json();

        // 记录缓存命中
        if (result.cached) {
          performanceMonitor.record({
            name: `Cache:HIT ${url}`,
            duration: 0,
            timestamp: Date.now(),
            success: true,
            cached: true,
          });
        }

        if (!response.ok || !result.success) {
          throw new ApiError(
            result.error || result.message || "请求失败",
            response.status
          );
        }

        return result.data as T;
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }

        throw new ApiError(
          error instanceof Error ? error.message : "网络请求失败"
        );
      }
    },
    { cached: false }
  );
}

/**
 * GET 请求
 */
export async function apiGet<T = unknown>(
  url: string,
  params?: Record<string, string | number | boolean>,
  signal?: AbortSignal
): Promise<T> {
  const searchParams = params
    ? "?" + new URLSearchParams(
        Object.entries(params).map(([key, value]) => [key, String(value)])
      ).toString()
    : "";

  return apiRequest<T>(url + searchParams, { method: "GET", signal });
}

/**
 * POST 请求
 */
export async function apiPost<T = unknown>(
  url: string,
  data?: unknown
): Promise<T> {
  return apiRequest<T>(url, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT 请求
 */
export async function apiPut<T = unknown>(
  url: string,
  data?: unknown
): Promise<T> {
  return apiRequest<T>(url, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PATCH 请求
 */
export async function apiPatch<T = unknown>(
  url: string,
  data?: unknown
): Promise<T> {
  return apiRequest<T>(url, {
    method: "PATCH",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE 请求
 */
export async function apiDelete<T = unknown>(url: string): Promise<T> {
  return apiRequest<T>(url, { method: "DELETE" });
}

/**
 * 处理 API 错误，返回用户友好的错误消息
 */
export function handleApiError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "操作失败，请重试";
}
