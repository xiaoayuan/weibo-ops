import { useEffect, useRef } from "react";

/**
 * 自动取消请求的 Hook
 * 组件卸载时自动取消所有未完成的请求
 */
export function useAbortController() {
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // 创建新的 AbortController
    controllerRef.current = new AbortController();

    // 组件卸载时取消请求
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);

  return controllerRef.current?.signal;
}

/**
 * 带取消功能的 fetch 请求
 */
export async function fetchWithCancel<T>(
  url: string,
  options?: RequestInit,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}
