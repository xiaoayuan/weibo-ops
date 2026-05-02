"use client";

import { useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { useSmartPolling } from "@/lib/hooks/use-polling";
import type { ActionJob } from "@/lib/app-data";

type JobsRealtimeListProps = {
  initialJobs: ActionJob[];
  onJobsUpdate?: (jobs: ActionJob[]) => void;
};

/**
 * 实时更新的任务列表组件
 * 
 * 特性：
 * - 自动轮询更新（3秒间隔）
 * - 页面不可见时暂停轮询
 * - 手动刷新功能
 * - 显示最后更新时间
 */
export function JobsRealtimeList({
  initialJobs,
  onJobsUpdate,
}: JobsRealtimeListProps) {
  const [jobs, setJobs] = useState(initialJobs);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 获取任务列表
  const fetchJobs = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/action-jobs");
      const result = await response.json();

      if (result.success) {
        setJobs(result.data);
        setLastUpdate(new Date());
        onJobsUpdate?.(result.data);
      }
    } catch (error) {
      console.error("获取任务列表失败:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onJobsUpdate]);

  // 智能轮询（页面不可见时自动暂停）
  const { refresh } = useSmartPolling(fetchJobs, {
    interval: 3000, // 3秒
    enabled: true,
  });

  // 格式化最后更新时间
  const formatLastUpdate = () => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);

    if (diff < 10) return "刚刚";
    if (diff < 60) return `${diff} 秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    return lastUpdate.toLocaleTimeString();
  };

  // 统计运行中的任务
  const runningCount = jobs.filter((job) => job.status === "RUNNING").length;

  return (
    <div className="space-y-4">
      {/* 状态栏 */}
      <div className="flex items-center justify-between rounded-lg bg-app-panel-muted p-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isRefreshing ? "animate-pulse bg-app-accent" : "bg-app-success"
              }`}
            />
            <span className="text-sm text-app-text-soft">
              {isRefreshing ? "更新中..." : "实时监控"}
            </span>
          </div>

          <div className="text-sm text-app-text-soft">
            最后更新: {formatLastUpdate()}
          </div>

          {runningCount > 0 && (
            <div className="rounded-full bg-app-accent/10 px-2 py-1 text-xs font-medium text-app-accent">
              {runningCount} 个任务运行中
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={isRefreshing}
          className="app-button-text text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          <span className="ml-1">刷新</span>
        </button>
      </div>

      {/* 任务列表 */}
      <div className="space-y-2">
        {jobs.length === 0 ? (
          <div className="rounded-lg border border-app-line bg-app-panel p-8 text-center">
            <p className="text-app-text-soft">暂无任务</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-lg border border-app-line bg-app-panel p-4 transition-colors hover:bg-app-panel-hover"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-app-text-strong">
                    任务 #{job.id.slice(0, 8)}
                  </div>
                  <div className="mt-1 text-sm text-app-text-soft">
                    创建时间: {new Date(job.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      job.status === "RUNNING"
                        ? "bg-app-info/10 text-app-info"
                        : job.status === "SUCCESS"
                          ? "bg-app-success/10 text-app-success"
                          : job.status === "FAILED"
                            ? "bg-app-danger/10 text-app-danger"
                            : "bg-app-text-soft/10 text-app-text-soft"
                    }`}
                  >
                    {job.status === "RUNNING" && "运行中"}
                    {job.status === "SUCCESS" && "成功"}
                    {job.status === "FAILED" && "失败"}
                    {job.status === "PENDING" && "待执行"}
                    {job.status === "CANCELLED" && "已取消"}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
