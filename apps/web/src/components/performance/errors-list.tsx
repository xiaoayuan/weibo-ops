"use client";

import { useEffect, useState } from "react";
import { performanceMonitor } from "@/lib/performance-monitor";
import { XCircle } from "lucide-react";
import { useSmartPolling } from "@/lib/hooks/use-polling";

type ErrorMetric = {
  name: string;
  duration: number;
  timestamp: number;
  error?: string;
};

export function ErrorsList() {
  const [errors, setErrors] = useState<ErrorMetric[]>([]);

  const fetchErrors = async () => {
    const errorList = performanceMonitor.getErrors();
    setErrors(errorList.slice(0, 50));
  };

  useSmartPolling(fetchErrors, { interval: 3000 });

  useEffect(() => {
    void fetchErrors();
  }, []);

  return (
    <div className="app-surface">
      <div className="pb-4 border-b border-app-line mb-4">
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-app-danger" />
          <h2 className="text-lg font-semibold text-app-text-strong">错误日志</h2>
        </div>
        <p className="text-sm text-app-text-soft mt-1">失败的 API 请求记录</p>
      </div>

      {errors.length === 0 ? (
        <div className="text-center py-8 text-app-text-soft">
          暂无错误记录
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="app-table">
            <thead>
              <tr>
                <th>请求名称</th>
                <th>错误信息</th>
                <th>耗时</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((error, index) => (
                <tr key={index}>
                  <td className="font-medium text-app-text-strong">{error.name}</td>
                  <td className="text-app-danger max-w-md truncate">
                    {error.error || "未知错误"}
                  </td>
                  <td className="text-sm text-app-text-muted">
                    {error.duration}ms
                  </td>
                  <td className="text-sm text-app-text-muted">
                    {new Date(error.timestamp).toLocaleTimeString()}
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
