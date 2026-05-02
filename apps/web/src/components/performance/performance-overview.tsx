"use client";

import { useEffect, useState } from "react";
import { performanceMonitor } from "@/lib/performance-monitor";
import { Activity, TrendingUp, TrendingDown, Zap, AlertCircle, CheckCircle } from "lucide-react";
import { useSmartPolling } from "@/lib/hooks/use-polling";

type PerformanceStats = {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  slowestRequest: { name: string; duration: number } | null;
  fastestRequest: { name: string; duration: number } | null;
};

export function PerformanceOverview() {
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [timeRange, setTimeRange] = useState<number>(5 * 60 * 1000);

  const fetchStats = async () => {
    const data = performanceMonitor.getStats(timeRange);
    setStats(data);
  };

  useSmartPolling(fetchStats, { interval: 3000 });

  useEffect(() => {
    void fetchStats();
  }, [timeRange]);

  if (!stats) {
    return <div className="text-gray-600 dark:text-gray-400">加载中...</div>;
  }

  const statCards = [
    {
      title: "总请求数",
      value: stats.totalRequests,
      icon: Activity,
      color: "text-blue-600",
    },
    {
      title: "成功率",
      value: `${stats.totalRequests > 0 ? Math.round((stats.successRequests / stats.totalRequests) * 100) : 0}%`,
      icon: CheckCircle,
      color: "text-green-600",
    },
    {
      title: "平均响应时间",
      value: `${stats.averageResponseTime}ms`,
      icon: Zap,
      color: "text-yellow-600",
    },
    {
      title: "缓存命中率",
      value: `${stats.cacheHitRate}%`,
      icon: TrendingUp,
      color: "text-purple-600",
    },
    {
      title: "错误率",
      value: `${stats.errorRate}%`,
      icon: AlertCircle,
      color: stats.errorRate > 5 ? "text-red-600" : "text-gray-600",
    },
  ];

  return (
    <div className="space-y-4">
      {/* 时间范围选择 */}
      <div className="flex gap-2">
        {[
          { label: "1 分钟", value: 60 * 1000 },
          { label: "5 分钟", value: 5 * 60 * 1000 },
          { label: "15 分钟", value: 15 * 60 * 1000 },
          { label: "1 小时", value: 60 * 60 * 1000 },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setTimeRange(option.value)}
            className={`px-3 py-1 rounded text-sm ${
              timeRange === option.value
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <div key={card.title} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.title}</h3>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{card.value}</div>
          </div>
        ))}
      </div>

      {/* 最快/最慢请求 */}
      <div className="grid gap-4 md:grid-cols-2">
        {stats.fastestRequest && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">最快请求</h3>
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.fastestRequest.name}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{stats.fastestRequest.duration}ms</div>
          </div>
        )}

        {stats.slowestRequest && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-red-600" />
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">最慢请求</h3>
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.slowestRequest.name}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{stats.slowestRequest.duration}ms</div>
          </div>
        )}
      </div>
    </div>
  );
}
