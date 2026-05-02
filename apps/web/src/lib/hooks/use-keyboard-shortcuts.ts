"use client";

import { useEffect, useCallback } from "react";

/**
 * 键盘快捷键配置
 */
export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Cmd on Mac, Win on Windows
  handler: (event: KeyboardEvent) => void;
  description?: string;
}

/**
 * 键盘快捷键 Hook
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl === undefined || event.ctrlKey === shortcut.ctrl;
        const shiftMatch = shortcut.shift === undefined || event.shiftKey === shortcut.shift;
        const altMatch = shortcut.alt === undefined || event.altKey === shortcut.alt;
        const metaMatch = shortcut.meta === undefined || event.metaKey === shortcut.meta;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
          event.preventDefault();
          shortcut.handler(event);
          break;
        }
      }
    },
    [shortcuts],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * 常用快捷键 Hook
 */
export function useCommonShortcuts(options: {
  onRefresh?: () => void;
  onNew?: () => void;
  onSave?: () => void;
  onSearch?: () => void;
  onDelete?: () => void;
  onEscape?: () => void;
}) {
  const shortcuts: KeyboardShortcut[] = [];

  if (options.onRefresh) {
    shortcuts.push({
      key: "r",
      meta: true,
      handler: options.onRefresh,
      description: "刷新",
    });
  }

  if (options.onNew) {
    shortcuts.push({
      key: "n",
      meta: true,
      handler: options.onNew,
      description: "新建",
    });
  }

  if (options.onSave) {
    shortcuts.push({
      key: "s",
      meta: true,
      handler: options.onSave,
      description: "保存",
    });
  }

  if (options.onSearch) {
    shortcuts.push({
      key: "k",
      meta: true,
      handler: options.onSearch,
      description: "搜索",
    });
  }

  if (options.onDelete) {
    shortcuts.push({
      key: "Backspace",
      meta: true,
      handler: options.onDelete,
      description: "删除",
    });
  }

  if (options.onEscape) {
    shortcuts.push({
      key: "Escape",
      handler: options.onEscape,
      description: "取消/关闭",
    });
  }

  useKeyboardShortcuts(shortcuts);
}

/**
 * 快捷键提示组件
 */
export function KeyboardShortcutHint({
  shortcut,
  className = "",
}: {
  shortcut: string;
  className?: string;
}) {
  const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const modifierKey = isMac ? "⌘" : "Ctrl";

  const formatted = shortcut
    .replace("Cmd", modifierKey)
    .replace("Ctrl", "Ctrl")
    .replace("Shift", "⇧")
    .replace("Alt", "⌥");

  return (
    <kbd
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-app-panel-muted text-app-text-soft rounded border border-app-line ${className}`}
    >
      {formatted}
    </kbd>
  );
}
