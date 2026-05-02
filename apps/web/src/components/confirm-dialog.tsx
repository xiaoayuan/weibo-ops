"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * 确认对话框属性
 */
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
  details?: string[];
}

/**
 * 确认对话框组件
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "确认",
  cancelText = "取消",
  type = "warning",
  details,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setIsConfirming(true);
      await onConfirm();
      onClose();
    } catch (error) {
      console.error("确认操作失败:", error);
    } finally {
      setIsConfirming(false);
    }
  };

  const typeStyles = {
    danger: {
      icon: "text-app-danger",
      button: "bg-app-danger hover:bg-app-danger/90",
    },
    warning: {
      icon: "text-app-warning",
      button: "bg-app-warning hover:bg-app-warning/90",
    },
    info: {
      icon: "text-app-accent",
      button: "bg-app-accent hover:bg-app-accent/90",
    },
  };

  const style = typeStyles[type];

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md app-surface shadow-2xl animate-in zoom-in-95 duration-200">
          {/* 头部 */}
          <div className="flex items-start gap-4 p-6 border-b border-app-line">
            <div className={`flex-shrink-0 ${style.icon}`}>
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-app-text-strong">
                {title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-app-text-soft hover:text-app-text-strong transition"
              disabled={isConfirming}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 内容 */}
          <div className="p-6 space-y-4">
            <p className="text-app-text">{message}</p>

            {details && details.length > 0 && (
              <div className="bg-app-panel-muted rounded-[12px] p-4">
                <p className="text-sm font-medium text-app-text-strong mb-2">
                  影响范围：
                </p>
                <ul className="space-y-1">
                  {details.map((detail, index) => (
                    <li
                      key={index}
                      className="text-sm text-app-text-soft flex items-start gap-2"
                    >
                      <span className="text-app-text-muted">•</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 底部按钮 */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-app-line">
            <button
              onClick={onClose}
              disabled={isConfirming}
              className="px-4 py-2 rounded-[12px] border border-app-line bg-app-panel-muted text-app-text hover:bg-app-panel-strong transition disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className={`px-4 py-2 rounded-[12px] text-white transition disabled:opacity-50 ${style.button}`}
            >
              {isConfirming ? "处理中..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * 使用确认对话框的 Hook
 */
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<Omit<ConfirmDialogProps, "isOpen" | "onClose">>({
    onConfirm: () => {},
    title: "",
    message: "",
  });

  const confirm = (newConfig: Omit<ConfirmDialogProps, "isOpen" | "onClose">) => {
    setConfig(newConfig);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
  };

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={close}
      {...config}
    />
  );

  return {
    confirm,
    close,
    ConfirmDialog: ConfirmDialogComponent,
  };
}
