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
    return <div className="text-app-text-soft">加载中...</div>;
  }

  const statCards = [
    {
      title: "总请求数",
      value: stats.totalRequests,
      icon: Activity,
      color: "text-app-info",
    },
    {
      title: "成功率",
      value: `${stats.totalRequests > 0 ? Math.round((stats.successRequests / stats.totalRequests) * 100) : 0}%`,
      icon: CheckCircle,
      color: "text-app-success",
    },
    {
      title: "平均响应时间",
      value: `${stats.averageResponseTime}ms`,
      icon: Zap,
      color: "text-app-warning",
    },
    {
      title: "缓存命中率",
      value: `${stats.cacheHitRate}%`,
      icon: TrendingUp,
      color: "text-purple-500",
    },
    {
      title: "错误率",
      value: `${stats.errorRate}%`,
      icon: AlertCircle,
      color: stats.errorRate > 5 ? "text-app-danger" : "text-app-text-soft",
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
            className={
              timeRange === option.value
                ? "app-button app-button-primary text-sm h-9"
                : "app-button app-button-secondary text-sm h-9"
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <div key={card.title} className="app-subpanel">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-app-text-soft">{card.title}</h3>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <div className="text-2xl font-bold text-app-text-strong">{card.value}</div>
          </div>
        ))}
      </div>

      {/* 最快/最慢请求 */}
      <div className="grid gap-4 md:grid-cols-2">
        {stats.fastestRequest && (
          <div className="app-subpanel">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-app-success" />
              <h3 className="text-xs font-medium uppercase tracking-wider text-app-text-soft">最快请求</h3>
            </div>
            <div className="text-lg font-semibold text-app-text-strong">{stats.fastestRequest.name}</div>
            <div className="text-sm text-app-text-muted">{stats.fastestRequest.duration}ms</div>
          </div>
        )}

        {stats.slowestRequest && (
          <div className="app-subpanel">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-app-danger" />
              <h3 className="text-xs font-medium uppercase tracking-wider text-app-text-soft">最慢请求</h3>
            </div>
            <div className="text-lg font-semibold text-app-text-strong">{stats.slowestRequest.name}</div>
            <div className="text-sm text-app-text-muted">{stats.slowestRequest.duration}ms</div>
          </div>
        )}
      </div>
    </div>
  );
}
