"use client";

import { CheckCircle, XCircle, AlertTriangle, Info, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/date";

/**
 * 日志级别
 */
export type LogLevel = "success" | "error" | "warning" | "info";

/**
 * 日志项属性
 */
interface LogItemProps {
  level: LogLevel;
  title: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
  onViewDetails?: () => void;
}

/**
 * 日志级别配置
 */
const levelConfig = {
  success: {
    icon: CheckCircle,
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-200 dark:border-green-800",
    label: "成功",
  },
  error: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800",
    label: "失败",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    border: "border-yellow-200 dark:border-yellow-800",
    label: "警告",
  },
  info: {
    icon: Info,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
    label: "信息",
  },
};

/**
 * 日志项组件
 */
export function LogItem({
  level,
  title,
  message,
  timestamp,
  details,
  onViewDetails,
}: LogItemProps) {
  const config = levelConfig[level];
  const Icon = config.icon;

  return (
    <div className={`flex gap-4 p-4 rounded-[12px] border ${config.border} ${config.bg}`}>
      {/* 图标 */}
      <div className="flex-shrink-0">
        <Icon className={`h-5 w-5 ${config.color}`} />
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        {/* 标题和标签 */}
        <div className="flex items-center gap-2 mb-1">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
          <h4 className="font-medium text-app-text-strong truncate">{title}</h4>
        </div>

        {/* 消息 */}
        <p className="text-sm text-app-text mb-2">{message}</p>

        {/* 时间和操作 */}
        <div className="flex items-center gap-4 text-xs text-app-text-muted">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDateTime(timestamp)}
          </span>
          {details && onViewDetails && (
            <button
              onClick={onViewDetails}
              className="text-app-accent hover:underline"
            >
              查看详情
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 时间线日志属性
 */
interface TimelineLogProps {
  logs: Array<{
    id: string;
    level: LogLevel;
    title: string;
    message: string;
    timestamp: string;
details?: Record<string, unknown>;
  }>;
  onViewDetails?: (log: unknown) => void;
}

/**
 * 时间线日志组件
 */
export function TimelineLog({ logs, onViewDetails }: TimelineLogProps) {
  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-app-text-muted">
        暂无日志
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 时间线 */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-app-line" />

      {/* 日志列表 */}
      <div className="space-y-4">
        {logs.map((log, index) => {
          const config = levelConfig[log.level];
          const Icon = config.icon;

          return (
            <div key={log.id} className="relative flex gap-4">
              {/* 时间线节点 */}
              <div className="flex-shrink-0 relative z-10">
                <div className={`w-12 h-12 rounded-full ${config.bg} border-2 ${config.border} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>
              </div>

              {/* 日志内容 */}
              <div className="flex-1 pb-8">
                <div className={`p-4 rounded-[12px] border ${config.border} app-surface`}>
                  {/* 标签和标题 */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
                      {config.label}
                    </span>
                    <h4 className="font-medium text-app-text-strong">{log.title}</h4>
                  </div>

                  {/* 消息 */}
                  <p className="text-sm text-app-text mb-3">{log.message}</p>

                  {/* 时间和操作 */}
                  <div className="flex items-center gap-4 text-xs text-app-text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(log.timestamp)}
                    </span>
                    {log.details && onViewDetails && (
                      <button
                        onClick={() => onViewDetails(log)}
                        className="text-app-accent hover:underline"
                      >
                        查看详情
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 日志统计组件
 */
interface LogStatsProps {
  total: number;
  success: number;
  error: number;
  warning: number;
  info: number;
}

export function LogStats({ total, success, error, warning, info }: LogStatsProps) {
  const stats = [
    { label: "总计", value: total, color: "text-app-text" },
    { label: "成功", value: success, color: "text-green-500" },
    { label: "失败", value: error, color: "text-red-500" },
    { label: "警告", value: warning, color: "text-yellow-500" },
    { label: "信息", value: info, color: "text-blue-500" },
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="p-4 rounded-[12px] border border-app-line bg-app-panel-muted"
        >
          <p className="text-sm text-app-text-muted mb-1">{stat.label}</p>
          <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
