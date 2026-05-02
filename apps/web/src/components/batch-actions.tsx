"use client";

import { useState } from "react";
import { Check, Square, Trash2, Edit, Download } from "lucide-react";

/**
 * 批量操作属性
 */
interface BatchActionsProps<T> {
  items: T[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  getId: (item: T) => string;
  actions?: BatchAction[];
  className?: string;
}

/**
 * 批量操作配置
 */
export interface BatchAction {
  label: string;
  icon?: React.ReactNode;
  onClick: (ids: string[]) => void | Promise<void>;
  type?: "default" | "danger" | "primary";
  disabled?: boolean;
}

/**
 * 批量操作工具栏
 */
export function BatchActions<T>({
  items,
  selectedIds,
  onSelectionChange,
  getId,
  actions = [],
  className = "",
}: BatchActionsProps<T>) {
  const [isProcessing, setIsProcessing] = useState(false);

  const allIds = items.map(getId);
  const isAllSelected = allIds.length > 0 && selectedIds.length === allIds.length;
  const isPartialSelected = selectedIds.length > 0 && selectedIds.length < allIds.length;

  const handleToggleAll = () => {
    if (isAllSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allIds);
    }
  };

  const handleAction = async (action: BatchAction) => {
    if (selectedIds.length === 0 || isProcessing) return;

    try {
      setIsProcessing(true);
      await action.onClick(selectedIds);
    } finally {
      setIsProcessing(false);
    }
  };

  const getButtonStyle = (type?: string) => {
    switch (type) {
      case "danger":
        return "bg-app-danger hover:bg-app-danger/90 text-white";
      case "primary":
        return "bg-app-accent hover:bg-app-accent/90 text-white";
      default:
        return "bg-app-panel-muted hover:bg-app-panel-strong text-app-text border border-app-line";
    }
  };

  if (items.length === 0) return null;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* 全选/反选 */}
      <button
        onClick={handleToggleAll}
        className="flex items-center gap-2 px-3 py-2 rounded-[12px] border border-app-line bg-app-panel-muted hover:bg-app-panel-strong transition text-sm"
        title={isAllSelected ? "取消全选" : "全选"}
      >
        {isAllSelected ? (
          <Check className="h-4 w-4 text-app-accent" />
        ) : isPartialSelected ? (
          <Square className="h-4 w-4 text-app-accent" />
        ) : (
          <Square className="h-4 w-4 text-app-text-muted" />
        )}
        <span className="text-app-text">
          {selectedIds.length > 0 ? `已选 ${selectedIds.length}` : "全选"}
        </span>
      </button>

      {/* 批量操作按钮 */}
      {selectedIds.length > 0 && (
        <>
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleAction(action)}
              disabled={action.disabled || isProcessing}
              className={`flex items-center gap-2 px-3 py-2 rounded-[12px] transition text-sm disabled:opacity-50 ${getButtonStyle(action.type)}`}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

/**
 * 可选择的表格行
 */
interface SelectableRowProps {
  isSelected: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

export function SelectableRow({
  isSelected,
  onToggle,
  children,
  className = "",
}: SelectableRowProps) {
  return (
    <div
      className={`flex items-center gap-3 border-b border-app-line hover:bg-app-panel-muted transition ${
        isSelected ? "bg-app-accent-soft" : ""
      } ${className}`}
    >
      <div className="flex-shrink-0 px-4">
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-5 h-5 rounded border border-app-line hover:border-app-accent transition"
        >
          {isSelected && <Check className="h-4 w-4 text-app-accent" />}
        </button>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/**
 * 批量操作 Hook
 */
export function useBatchSelection<T>(items: T[], getId: (item: T) => string) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    const allIds = items.map(getId);
    setSelectedIds((prev) =>
      prev.length === allIds.length ? [] : allIds
    );
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const isSelected = (id: string) => selectedIds.includes(id);

  const isAllSelected = items.length > 0 && selectedIds.length === items.length;

  const selectedItems = items.filter((item) => selectedIds.includes(getId(item)));

  return {
    selectedIds,
    selectedItems,
    setSelectedIds,
    toggleItem,
    toggleAll,
    clearSelection,
    isSelected,
    isAllSelected,
  };
}

/**
 * 常用批量操作
 */
export const commonBatchActions = {
  delete: (onDelete: (ids: string[]) => void | Promise<void>): BatchAction => ({
    label: "批量删除",
    icon: <Trash2 className="h-4 w-4" />,
    onClick: onDelete,
    type: "danger",
  }),

  edit: (onEdit: (ids: string[]) => void | Promise<void>): BatchAction => ({
    label: "批量编辑",
    icon: <Edit className="h-4 w-4" />,
    onClick: onEdit,
    type: "default",
  }),

  export: (onExport: (ids: string[]) => void | Promise<void>): BatchAction => ({
    label: "批量导出",
    icon: <Download className="h-4 w-4" />,
    onClick: onExport,
    type: "default",
  }),
};
