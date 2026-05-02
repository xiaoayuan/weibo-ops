import { useState, useCallback, useRef, useEffect } from "react";
import { apiGet, handleApiError } from "@/lib/api/client";
import type { PaginationInfo } from "@/components/pagination";

export type PaginatedResponse<T> = {
  data: T[];
  pagination: PaginationInfo;
};

export function usePaginatedData<T>(
  baseUrl: string,
  initialPageSize: number = 50
) {
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: initialPageSize,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 组件卸载时取消请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const fetchData = useCallback(
    async (page: number = pagination.page, pageSize: number = pagination.pageSize) => {
      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // 创建新的 AbortController
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);
      try {
        const result = await apiGet<PaginatedResponse<T>>(
          baseUrl,
          { page, pageSize },
          abortControllerRef.current.signal
        );
        setData(result.data);
        setPagination(result.pagination);
      } catch (err) {
        // 忽略取消的请求
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, pagination.page, pagination.pageSize]
  );

  const goToPage = useCallback(
    (page: number) => {
      fetchData(page, pagination.pageSize);
    },
    [fetchData, pagination.pageSize]
  );

  const changePageSize = useCallback(
    (pageSize: number) => {
      fetchData(1, pageSize);
    },
    [fetchData]
  );

  const refresh = useCallback(() => {
    fetchData(pagination.page, pagination.pageSize);
  }, [fetchData, pagination.page, pagination.pageSize]);

  return {
    data,
    pagination,
    loading,
    error,
    fetchData,
    goToPage,
    changePageSize,
    refresh,
  };
}
