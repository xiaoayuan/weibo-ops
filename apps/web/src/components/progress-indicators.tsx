"use client";

import { CheckCircle, XCircle, Clock, Loader } from "lucide-react";

/**
 * 进度条属性
 */
interface ProgressBarProps {
  total: number;
  completed: number;
  failed?: number;
  pending?: number;
  showLabel?: boolean;
  height?: string;
  className?: string;
}

/**
 * 进度条组件
 */
export function ProgressBar({
  total,
  completed,
  failed = 0,
  pending = 0,
  showLabel = true,
  height = "h-3",
  className = "",
}: ProgressBarProps) {
  if (total === 0) {
    return (
      <div className={`text-sm text-app-text-muted ${className}`}>
        暂无数据
      </div>
    );
  }

  const completedPercent = (completed / total) * 100;
  const failedPercent = (failed / total) * 100;
  const pendingPercent = (pending / total) * 100;

  return (
    <div className={className}>
      {/* 进度条 */}
      <div className={`w-full ${height} rounded-full bg-app-panel-muted overflow-hidden flex`}>
        {/* 成功部分 */}
        {completed > 0 && (
          <div
            className="bg-green-500 transition-all duration-300"
            style={{ width: `${completedPercent}%` }}
          />
        )}
        {/* 失败部分 */}
        {failed > 0 && (
          <div
            className="bg-red-500 transition-all duration-300"
            style={{ width: `${failedPercent}%` }}
          />
        )}
        {/* 待处理部分 */}
        {pending > 0 && (
          <div
            className="bg-yellow-500 transition-all duration-300"
            style={{ width: `${pendingPercent}%` }}
          />
        )}
      </div>

      {/* 标签 */}
      {showLabel && (
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span className="text-app-text">
            {completed}/{total}
          </span>
          {failed > 0 && (
            <span className="text-red-500">失败 {failed}</span>
          )}
          {pending > 0 && (
            <span className="text-yellow-500">待处理 {pending}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 圆形进度条属性
 */
interface CircularProgressProps {
  total: number;
  completed: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  className?: string;
}

/**
 * 圆形进度条组件
 */
export function CircularProgress({
  total,
  completed,
  size = 120,
  strokeWidth = 8,
  showLabel = true,
  className = "",
}: CircularProgressProps) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* 背景圆 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-app-panel-muted"
        />
        {/* 进度圆 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-app-accent transition-all duration-300"
        />
      </svg>

      {/* 中心标签 */}
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-app-text-strong">
            {Math.round(percentage)}%
          </span>
          <span className="text-xs text-app-text-muted">
            {completed}/{total}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * 任务状态卡片属性
 */
interface TaskStatusCardProps {
  title: string;
  total: number;
  completed: number;
  running: number;
  failed: number;
  pending: number;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * 任务状态卡片组件
 */
export function TaskStatusCard({
  title,
  total,
  completed,
  running,
  failed,
  pending,
  icon,
  className = "",
}: TaskStatusCardProps) {
  const stats = [
    {
      label: "已完成",
      value: completed,
      icon: CheckCircle,
      color: "text-green-500",
      bg: "bg-green-50 dark:bg-green-900/20",
    },
    {
      label: "执行中",
      value: running,
      icon: Loader,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "失败",
      value: failed,
      icon: XCircle,
      color: "text-red-500",
      bg: "bg-red-50 dark:bg-red-900/20",
    },
    {
      label: "待执行",
      value: pending,
      icon: Clock,
      color: "text-yellow-500",
      bg: "bg-yellow-50 dark:bg-yellow-900/20",
    },
  ];

  return (
    <div className={`p-6 rounded-[18px] border border-app-line app-surface ${className}`}>
      {/* 头部 */}
      <div className="flex items-center gap-3 mb-6">
        {icon && <div className="text-app-accent">{icon}</div>}
        <div>
          <h3 className="text-lg font-semibold text-app-text-strong">{title}</h3>
          <p className="text-sm text-app-text-muted">总计 {total} 个任务</p>
        </div>
      </div>

      {/* 进度条 */}
      <ProgressBar
        total={total}
        completed={completed}
        failed={failed}
        pending={pending}
        className="mb-6"
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`p-3 rounded-[12px] ${stat.bg}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-app-text-muted">{stat.label}</span>
              </div>
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 迷你进度指示器
 */
interface MiniProgressProps {
  percentage: number;
  label?: string;
  className?: string;
}

export function MiniProgress({ percentage, label, className = "" }: MiniProgressProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && (
        <span className="text-xs text-app-text-muted whitespace-nowrap">
          {label}
        </span>
      )}
      <div className="flex-1 h-2 rounded-full bg-app-panel-muted overflow-hidden">
        <div
          className="h-full bg-app-accent transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
      <span className="text-xs text-app-text-muted whitespace-nowrap">
        {Math.round(percentage)}%
      </span>
    </div>
  );
}
