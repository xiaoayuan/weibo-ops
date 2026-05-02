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
    <div className="app-surface">
      <div className="pb-4 border-b border-app-line mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-app-warning" />
            <h2 className="text-lg font-semibold text-app-text-strong">慢查询列表</h2>
          </div>
          <select
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="app-input h-9 w-auto px-3"
          >
            <option value={500}>500ms</option>
            <option value={1000}>1000ms</option>
            <option value={2000}>2000ms</option>
            <option value={5000}>5000ms</option>
          </select>
        </div>
        <p className="text-sm text-app-text-soft mt-1">响应时间超过阈值的请求</p>
      </div>

      {slowQueries.length === 0 ? (
        <div className="text-center py-8 text-app-text-soft">
          暂无慢查询记录
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="app-table">
            <thead>
              <tr>
                <th>请求名称</th>
                <th>耗时</th>
                <th>时间</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {slowQueries.map((query, index) => (
                <tr key={index}>
                  <td className="font-medium text-app-text-strong">{query.name}</td>
                  <td>
                    <span className={query.duration > 2000 ? "text-app-danger font-semibold" : "text-app-warning"}>
                      {query.duration}ms
                    </span>
                  </td>
                  <td className="text-sm text-app-text-muted">
                    {new Date(query.timestamp).toLocaleTimeString()}
                  </td>
                  <td>
                    {query.success ? (
                      <span className="text-app-success">成功</span>
                    ) : (
                      <span className="text-app-danger">失败</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
