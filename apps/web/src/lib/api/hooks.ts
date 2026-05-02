import { useState, useCallback } from "react";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, handleApiError } from "@/lib/api/client";

/**
 * 通用的数据获取 hook
 */
export function useApiData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<T>(url);
      setData(result);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, [url]);

  const refetch = useCallback(() => {
    return fetch();
  }, [fetch]);

  return { data, loading, error, fetch, refetch };
}

/**
 * 通用的数据提交 hook
 */
export function useApiMutation<TData = unknown, TResult = unknown>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (
      url: string,
      data?: TData,
      method: "POST" | "PUT" | "PATCH" | "DELETE" = "POST"
    ): Promise<TResult | null> => {
      setLoading(true);
      setError(null);
      try {
        let result: TResult;
        switch (method) {
          case "POST":
            result = await apiPost<TResult>(url, data);
            break;
          case "PUT":
            result = await apiPut<TResult>(url, data);
            break;
          case "PATCH":
            result = await apiPatch<TResult>(url, data);
            break;
          case "DELETE":
            result = await apiDelete<TResult>(url);
            break;
        }
        return result;
      } catch (err) {
        setError(handleApiError(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { mutate, loading, error };
}
