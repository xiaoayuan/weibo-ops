"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { readJsonResponse } from "./http";

/**
 * API 响应类型
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Fetcher 函数
 */
async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const result = await readJsonResponse<ApiResponse<T>>(response);

  if (!response.ok) {
    throw new Error(result.message || "请求失败");
  }

  return result.data;
}

/**
 * 使用 API 的 Hook（带缓存）
 */
export function useApi<T>(
  url: string | null,
  options?: SWRConfiguration
) {
  const { data, error, isLoading, mutate } = useSWR<T>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
      ...options,
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
    refresh: () => mutate(),
  };
}

/**
 * 使用账号列表
 */
export function useAccounts() {
  return useApi<any[]>("/api/accounts");
}

/**
 * 使用计划列表
 */
export function usePlans(date?: string) {
  const url = date ? `/api/plans?date=${date}` : "/api/plans";
  return useApi<any[]>(url);
}

/**
 * 使用互动任务列表
 */
export function useInteractionTasks() {
  return useApi<any[]>("/api/interaction-tasks");
}

/**
 * 使用执行日志列表
 */
export function useLogs(page: number = 1, pageSize: number = 50) {
  return useApi<any>(`/api/logs?page=${page}&pageSize=${pageSize}`);
}

/**
 * 使用超话列表
 */
export function useSuperTopics() {
  return useApi<any[]>("/api/super-topics");
}

/**
 * 使用文案库列表
 */
export function useCopywriting() {
  return useApi<any[]>("/api/copywriting");
}

/**
 * 使用任务列表
 */
export function useTopicTasks() {
  return useApi<any[]>("/api/topic-tasks");
}

/**
 * 使用用户列表
 */
export function useUsers() {
  return useApi<any[]>("/api/users");
}

/**
 * 使用代理节点列表
 */
export function useProxyNodes() {
  return useApi<any[]>("/api/proxy-nodes");
}

/**
 * 使用评论池列表
 */
export function useCommentPool() {
  return useApi<any[]>("/api/comment-pool");
}

/**
 * 使用编排任务列表
 */
export function useActionJobs() {
  return useApi<any[]>("/api/action-jobs");
}

/**
 * POST 请求 Hook
 */
export async function apiPost<T>(
  url: string,
  data?: any
): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });

  return readJsonResponse<ApiResponse<T>>(response);
}

/**
 * PUT 请求 Hook
 */
export async function apiPut<T>(
  url: string,
  data?: any
): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });

  return readJsonResponse<ApiResponse<T>>(response);
}

/**
 * DELETE 请求 Hook
 */
export async function apiDelete<T>(url: string): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    method: "DELETE",
  });

  return readJsonResponse<ApiResponse<T>>(response);
}

/**
 * 批量操作 Hook
 */
export async function apiBatch<T>(
  url: string,
  ids: string[]
): Promise<ApiResponse<T>> {
  return apiPost<T>(url, { ids });
}
