"use client";

import { useState, useCallback } from "react";
import { X, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";

export type BatchItemStatus = "pending" | "processing" | "success" | "error";

export interface BatchItem {
  id: string;
  name: string;
  status: BatchItemStatus;
  error?: string;
}

interface BatchProgressProps {
  items: BatchItem[];
  onCancel?: () => void;
  onClose?: () => void;
  title?: string;
  className?: string;
}

export function BatchProgress({
  items,
  onCancel,
  onClose,
  title = "批量操作进度",
  className = "",
}: BatchProgressProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const totalCount = items.length;
  const successCount = items.filter((item) => item.status === "success").length;
  const errorCount = items.filter((item) => item.status === "error").length;
  const completedCount = successCount + errorCount;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isCompleted = completedCount === totalCount;

  return (
    <div className={`fixed bottom-4 right-4 z-50 w-96 app-surface shadow-2xl ${className}`}>
      <div className="flex items-center justify-between p-4 border-b border-app-line">
        <div className="flex items-center gap-3">
          {isCompleted ? (
            errorCount > 0 ? (
              <AlertCircle className="h-5 w-5 text-app-warning" />
            ) : (
              <CheckCircle className="h-5 w-5 text-app-success" />
            )
          ) : (
            <Loader2 className="h-5 w-5 text-app-accent animate-spin" />
          )}
          <div>
            <h3 className="text-sm font-medium text-app-text-strong">{title}</h3>
            <p className="text-xs text-app-text-muted mt-0.5">
              {isCompleted
                ? `完成 ${successCount}/${totalCount}${errorCount > 0 ? `，失败 ${errorCount}` : ""}`
                : `进行中 ${completedCount}/${totalCount}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-app-text-soft hover:text-app-text-strong transition text-xs"
          >
            {isExpanded ? "收起" : "展开"}
          </button>
          {!isCompleted && onCancel && (
            <button onClick={onCancel} className="text-app-text-soft hover:text-app-danger transition">
              <X className="h-4 w-4" />
            </button>
          )}
          {isCompleted && onClose && (
            <button onClick={onClose} className="text-app-text-soft hover:text-app-text-strong transition">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-app-line">
        <div className="flex items-center justify-between text-xs text-app-text-muted mb-2">
          <span>{Math.round(progress)}%</span>
          <span>{successCount} 成功 / {errorCount} 失败</span>
        </div>
        <div className="h-2 bg-app-panel-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${errorCount > 0 ? "bg-app-warning" : "bg-app-success"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="max-h-64 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 px-4 py-3 border-b border-app-line last:border-0">
              <div className="flex-shrink-0 mt-0.5">
                {item.status === "success" && <CheckCircle className="h-4 w-4 text-app-success" />}
                {item.status === "error" && <XCircle className="h-4 w-4 text-app-danger" />}
                {item.status === "processing" && <Loader2 className="h-4 w-4 text-app-accent animate-spin" />}
                {item.status === "pending" && <div className="h-4 w-4 rounded-full border-2 border-app-line" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-app-text truncate">{item.name}</p>
                {item.error && <p className="text-xs text-app-danger mt-1">{item.error}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function useBatchOperation<T>() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);

  const execute = useCallback(
    async (
      data: T[],
      operation: (item: T) => Promise<void>,
      getName: (item: T) => string,
      getId: (item: T) => string,
    ) => {
      setIsRunning(true);
      setIsCancelled(false);

      const initialItems: BatchItem[] = data.map((item) => ({
        id: getId(item),
        name: getName(item),
        status: "pending",
      }));
      setItems(initialItems);

      for (let i = 0; i < data.length; i++) {
        if (isCancelled) break;

        const item = data[i];
        const itemId = getId(item);

        setItems((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, status: "processing" } : it)),
        );

        try {
          await operation(item);
          setItems((prev) =>
            prev.map((it) => (it.id === itemId ? { ...it, status: "success" } : it)),
          );
        } catch (error) {
          setItems((prev) =>
            prev.map((it) =>
              it.id === itemId
                ? { ...it, status: "error", error: error instanceof Error ? error.message : "操作失败" }
                : it,
            ),
          );
        }
      }

      setIsRunning(false);
    },
    [isCancelled],
  );

  const cancel = useCallback(() => {
    setIsCancelled(true);
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setItems([]);
    setIsRunning(false);
    setIsCancelled(false);
  }, []);

  return {
    items,
    isRunning,
    isCancelled,
    execute,
    cancel,
    reset,
  };
}
