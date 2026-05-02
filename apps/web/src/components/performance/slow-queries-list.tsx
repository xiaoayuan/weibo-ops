"use client";

import { useEffect, useState } from "react";
import { performanceMonitor } from "@/lib/performance-monitor";
import { AlertTriangle } from "lucide-react";
import { useSmartPolling } from "@/lib/hooks/use-polling";

type SlowQuery = {
  name: string;
  duration: number;
  timestamp: number;
  success: boolean;
};

export function SlowQueriesList() {
  const [slowQueries, setSlowQueries] = useState<SlowQuery[]>([]);
  const [threshold, setThreshold] = useState<number>(1000);

  const fetchSlowQueries = async () => {
    const queries = performanceMonitor.getSlowQueries(threshold);
    setSlowQueries(queries.slice(0, 50));
  };

  useSmartPolling(fetchSlowQueries, { interval: 3000 });

  useEffect(() => {
    void fetchSlowQueries();
  }, [threshold]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">慢查询列表</h2>
          </div>
          <select
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value={500}>500ms</option>
            <option value={1000}>1000ms</option>
            <option value={2000}>2000ms</option>
            <option value={5000}>5000ms</option>
          </select>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">响应时间超过阈值的请求</p>
      </div>

      <div className="p-4">
        {slowQueries.length === 0 ? (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">
            暂无慢查询记录
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">请求名称</th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">耗时</th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">时间</th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">状态</th>
                </tr>
              </thead>
              <tbody>
                {slowQueries.map((query, index) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <td className="py-2 px-4 font-medium text-gray-900 dark:text-gray-100">{query.name}</td>
                    <td className="py-2 px-4">
                      <span className={query.duration > 2000 ? "text-red-600 font-semibold" : "text-yellow-600"}>
                        {query.duration}ms
                      </span>
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(query.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-4">
                      {query.success ? (
                        <span className="text-green-600">成功</span>
                      ) : (
                        <span className="text-red-600">失败</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
