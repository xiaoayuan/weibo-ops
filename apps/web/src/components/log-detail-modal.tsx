"use client";

import { useState } from "react";
import { X, Copy, Check, ChevronDown, ChevronRight } from "lucide-react";
import { formatDateTime } from "@/lib/date";

/**
 * 日志详情模态框属性
 */
interface LogEntry {
  id: string;
  actionType: string;
  createdAt: string;
  success: boolean;
  account?: { nickname: string } | null;
  requestPayload?: Record<string, unknown> | null;
  responsePayload?: Record<string, unknown> | null;
  errorMessage?: string | null;
}

interface LogDetailModalProps {
  log: LogEntry;
  onClose: () => void;
}

/**
 * 日志详情模态框组件
 */
export function LogDetailModal({ log, onClose }: LogDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["basic", "request", "response"])
  );

  if (!log) return null;

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const renderJson = (data: unknown) => {
    if (!data) return <span className="text-app-text-muted">无数据</span>;

    try {
      const formatted = JSON.stringify(data, null, 2);
      return (
        <pre className="text-xs text-app-text bg-app-panel-muted p-3 rounded-[8px] overflow-x-auto">
          {formatted}
        </pre>
      );
    } catch {
      return <span className="text-app-text-muted">无效数据</span>;
    }
  };

  const sections = [
    {
      id: "basic",
      title: "基本信息",
      content: (
        <div className="space-y-2 text-sm">
          <div className="flex">
            <span className="w-24 text-app-text-muted">日志 ID:</span>
            <span className="text-app-text font-mono">{log.id}</span>
          </div>
          <div className="flex">
            <span className="w-24 text-app-text-muted">操作类型:</span>
            <span className="text-app-text">{log.actionType}</span>
          </div>
          <div className="flex">
            <span className="w-24 text-app-text-muted">执行时间:</span>
            <span className="text-app-text">{formatDateTime(log.createdAt)}</span>
          </div>
          <div className="flex">
            <span className="w-24 text-app-text-muted">执行状态:</span>
            <span className={log.success ? "text-green-500" : "text-red-500"}>
              {log.success ? "成功" : "失败"}
            </span>
          </div>
          {log.account && (
            <div className="flex">
              <span className="w-24 text-app-text-muted">执行账号:</span>
              <span className="text-app-text">{log.account.nickname}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "request",
      title: "请求参数",
      content: renderJson(log.requestPayload),
    },
    {
      id: "response",
      title: "响应结果",
      content: renderJson(log.responsePayload),
    },
  ];

  if (log.errorMessage) {
    sections.push({
      id: "error",
      title: "错误信息",
      content: (
        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-[8px]">
          {log.errorMessage}
        </div>
      ),
    });
  }

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 模态框 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl max-h-[90vh] app-surface shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
          {/* 头部 */}
          <div className="flex items-center justify-between p-6 border-b border-app-line flex-shrink-0">
            <h2 className="text-lg font-semibold text-app-text-strong">
              执行日志详情
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(JSON.stringify(log, null, 2))}
                className="p-2 rounded-[8px] hover:bg-app-panel-muted transition"
                title="复制全部"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-app-text-soft" />
                )}
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-[8px] hover:bg-app-panel-muted transition"
              >
                <X className="h-4 w-4 text-app-text-soft" />
              </button>
            </div>
          </div>

          {/* 内容 */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {sections.map((section) => {
              const isExpanded = expandedSections.has(section.id);
              return (
                <div
                  key={section.id}
                  className="border border-app-line rounded-[12px] overflow-hidden"
                >
                  {/* 标题 */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between p-4 bg-app-panel-muted hover:bg-app-panel-strong transition"
                  >
                    <span className="font-medium text-app-text-strong">
                      {section.title}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-app-text-soft" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-app-text-soft" />
                    )}
                  </button>

                  {/* 内容 */}
                  {isExpanded && (
                    <div className="p-4 bg-app-surface">
                      {section.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 底部 */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-app-line flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-[12px] border border-app-line bg-app-panel-muted text-app-text hover:bg-app-panel-strong transition"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * 可展开的日志行
 */
interface ExpandableLogRowProps {
  log: LogEntry;
  children: React.ReactNode;
  onViewDetails?: () => void;
}

export function ExpandableLogRow({
  log,
  children,
  onViewDetails,
}: ExpandableLogRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-b border-app-line">
      {/* 主行 */}
      <div className="flex items-center gap-2 hover:bg-app-panel-muted transition">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 hover:bg-app-panel-strong transition"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-app-text-soft" />
          ) : (
            <ChevronRight className="h-4 w-4 text-app-text-soft" />
          )}
        </button>
        <div className="flex-1">{children}</div>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="p-4 bg-app-panel-muted space-y-3">
          {/* 请求参数 */}
          {log.requestPayload ? (
            <div>
              <h4 className="text-sm font-medium text-app-text-strong mb-2">
                请求参数
              </h4>
              <pre className="text-xs text-app-text bg-app-surface p-3 rounded-[8px] overflow-x-auto">
                {JSON.stringify(log.requestPayload, null, 2)}
              </pre>
            </div>
          ) : null}

          {/* 响应结果 */}
          {log.responsePayload ? (
            <div>
              <h4 className="text-sm font-medium text-app-text-strong mb-2">
                响应结果
              </h4>
              <pre className="text-xs text-app-text bg-app-surface p-3 rounded-[8px] overflow-x-auto">
                {JSON.stringify(log.responsePayload, null, 2)}
              </pre>
            </div>
          ) : null}

          {/* 查看详情按钮 */}
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="text-sm text-app-accent hover:underline"
            >
              查看完整详情
            </button>
          )}
        </div>
      )}
    </div>
  );
}
