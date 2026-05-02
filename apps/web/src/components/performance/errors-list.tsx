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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">错误日志</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">失败的 API 请求记录</p>
      </div>

      <div className="p-4">
        {errors.length === 0 ? (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">
            暂无错误记录
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">请求名称</th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">错误信息</th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">耗时</th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">时间</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((error, index) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <td className="py-2 px-4 font-medium text-gray-900 dark:text-gray-100">{error.name}</td>
                    <td className="py-2 px-4 text-red-600 max-w-md truncate">
                      {error.error || "未知错误"}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {error.duration}ms
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(error.timestamp).toLocaleTimeString()}
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
