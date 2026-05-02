"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";

/**
 * 撤销操作配置
 */
interface UndoableActionOptions {
  message: string;
  duration?: number;
  onUndo: () => void | Promise<void>;
  onConfirm?: () => void | Promise<void>;
}

/**
 * 撤销操作 Hook
 * 
 * 提供带撤销功能的操作
 */
export function useUndoableAction() {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 执行可撤销的操作
   */
  const execute = useCallback(
    async (options: UndoableActionOptions) => {
      const { message, duration = 5000, onUndo, onConfirm } = options;

      let isUndone = false;

      // 显示 Toast 通知
      toast.success(message, {
        duration,
        action: {
          label: "撤销",
          onClick: async () => {
            isUndone = true;
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            await onUndo();
            toast.info("操作已撤销");
          },
        },
      });

      // 设置确认超时
      timeoutRef.current = setTimeout(async () => {
        if (!isUndone && onConfirm) {
          await onConfirm();
        }
      }, duration);
    },
    [],
  );

  return { execute };
}

/**
 * 删除操作 Hook（带撤销）
 */
export function useUndoableDelete<T>() {
  const { execute } = useUndoableAction();
  const deletedItemRef = useRef<T | null>(null);

  /**
   * 执行删除操作
   */
  const deleteItem = useCallback(
    async (
      item: T,
      options: {
        getName: (item: T) => string;
        onDelete: (item: T) => void | Promise<void>;
        onRestore: (item: T) => void | Promise<void>;
        onConfirm?: (item: T) => void | Promise<void>;
      },
    ) => {
      const { getName, onDelete, onRestore, onConfirm } = options;
      deletedItemRef.current = item;

      // 立即执行删除（UI 层面）
      await onDelete(item);

      // 显示撤销通知
      await execute({
        message: `已删除 ${getName(item)}`,
        onUndo: async () => {
          if (deletedItemRef.current) {
            await onRestore(deletedItemRef.current);
            deletedItemRef.current = null;
          }
        },
        onConfirm: async () => {
          if (deletedItemRef.current && onConfirm) {
            await onConfirm(deletedItemRef.current);
            deletedItemRef.current = null;
          }
        },
      });
    },
    [execute],
  );

  return { deleteItem };
}

/**
 * 批量删除操作 Hook（带撤销）
 */
export function useUndoableBatchDelete<T>() {
  const { execute } = useUndoableAction();
  const deletedItemsRef = useRef<T[]>([]);

  /**
   * 执行批量删除操作
   */
  const deleteItems = useCallback(
    async (
      items: T[],
      options: {
        onDelete: (items: T[]) => void | Promise<void>;
        onRestore: (items: T[]) => void | Promise<void>;
        onConfirm?: (items: T[]) => void | Promise<void>;
      },
    ) => {
      const { onDelete, onRestore, onConfirm } = options;
      deletedItemsRef.current = items;

      // 立即执行删除（UI 层面）
      await onDelete(items);

      // 显示撤销通知
      await execute({
        message: `已删除 ${items.length} 项`,
        onUndo: async () => {
          if (deletedItemsRef.current.length > 0) {
            await onRestore(deletedItemsRef.current);
            deletedItemsRef.current = [];
          }
        },
        onConfirm: async () => {
          if (deletedItemsRef.current.length > 0 && onConfirm) {
            await onConfirm(deletedItemsRef.current);
            deletedItemsRef.current = [];
          }
        },
      });
    },
    [execute],
  );

  return { deleteItems };
}
