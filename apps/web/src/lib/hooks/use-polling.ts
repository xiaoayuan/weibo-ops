import { useEffect, useRef, useCallback, useState } from "react";

type PollingOptions = {
  interval?: number; // 轮询间隔（毫秒），默认 3000
  enabled?: boolean; // 是否启用轮询，默认 true
  onError?: (error: Error) => void; // 错误回调
};

/**
 * 轮询 Hook
 * 
 * @example
 * ```typescript
 * const { data, loading, error, refresh } = usePolling(
 *   async () => {
 *     const response = await fetch('/api/jobs');
 *     return response.json();
 *   },
 *   { interval: 5000, enabled: true }
 * );
 * ```
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  options: PollingOptions = {}
) {
  const {
    interval = 3000,
    enabled = true,
    onError,
  } = options;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);

  // 更新 fetcher 引用
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  // 执行轮询
  const poll = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      await fetcherRef.current();
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  }, [onError]);

  // 启动轮询
  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // 立即执行一次
    poll();

    // 设置定时器
    timerRef.current = setInterval(poll, interval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, interval, poll]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // 手动刷新
  const refresh = useCallback(() => {
    poll();
  }, [poll]);

  return { refresh };
}

/**
 * 智能轮询 Hook - 根据页面可见性自动暂停/恢复
 * 
 * @example
 * ```typescript
 * useSmartPolling(
 *   async () => {
 *     const response = await fetch('/api/jobs');
 *     const data = await response.json();
 *     setJobs(data);
 *   },
 *   { interval: 5000 }
 * );
 * ```
 */
export function useSmartPolling<T>(
  fetcher: () => Promise<T>,
  options: PollingOptions = {}
) {
  const [isVisible, setIsVisible] = useState(true);

  // 监听页面可见性
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // 只在页面可见时轮询
  return usePolling(fetcher, {
    ...options,
    enabled: options.enabled !== false && isVisible,
  });
}

/**
 * 条件轮询 Hook - 满足条件时停止轮询
 * 
 * @example
 * ```typescript
 * useConditionalPolling(
 *   async () => {
 *     const response = await fetch('/api/jobs/123');
 *     const data = await response.json();
 *     setJob(data);
 *     return data;
 *   },
 *   (data) => data.status === 'SUCCESS' || data.status === 'FAILED',
 *   { interval: 2000 }
 * );
 * ```
 */
export function useConditionalPolling<T>(
  fetcher: () => Promise<T>,
  stopCondition: (data: T) => boolean,
  options: PollingOptions = {}
) {
  const [shouldStop, setShouldStop] = useState(false);

  const wrappedFetcher = useCallback(async () => {
    const data = await fetcher();
    if (stopCondition(data)) {
      setShouldStop(true);
    }
    return data;
  }, [fetcher, stopCondition]);

  return usePolling(wrappedFetcher, {
    ...options,
    enabled: options.enabled !== false && !shouldStop,
  });
}
