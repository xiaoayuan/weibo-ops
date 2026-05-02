"use client";

import { useState } from "react";
import { Keyboard, X } from "lucide-react";
import { useKeyboardShortcuts, KeyboardShortcutHint } from "@/lib/hooks/use-keyboard-shortcuts";

/**
 * 快捷键帮助面板
 */
export function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  // 监听 ? 键打开帮助
  useKeyboardShortcuts([
    {
      key: "?",
      shift: true,
      handler: () => setIsOpen(true),
    },
  ]);

  const shortcuts = [
    { keys: "Cmd+R", description: "刷新当前页面" },
    { keys: "Cmd+N", description: "新建项目" },
    { keys: "Cmd+S", description: "保存" },
    { keys: "Cmd+K", description: "搜索" },
    { keys: "Cmd+Backspace", description: "删除" },
    { keys: "Escape", description: "取消/关闭" },
    { keys: "?", description: "显示快捷键帮助" },
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-50 p-3 app-surface shadow-lg hover:shadow-xl transition rounded-full"
        title="键盘快捷键 (?)"
      >
        <Keyboard className="h-5 w-5 text-app-text-soft" />
      </button>
    );
  }

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => setIsOpen(false)}
      />

      {/* 帮助面板 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md app-surface shadow-2xl">
          {/* 头部 */}
          <div className="flex items-center justify-between p-6 border-b border-app-line">
            <div className="flex items-center gap-3">
              <Keyboard className="h-5 w-5 text-app-accent" />
              <h2 className="text-lg font-semibold text-app-text-strong">
                键盘快捷键
              </h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-app-text-soft hover:text-app-text-strong transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 快捷键列表 */}
          <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
            {shortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2"
              >
                <span className="text-sm text-app-text">{shortcut.description}</span>
                <KeyboardShortcutHint shortcut={shortcut.keys} />
              </div>
            ))}
          </div>

          {/* 底部提示 */}
          <div className="px-6 py-4 border-t border-app-line bg-app-panel-muted">
            <p className="text-xs text-app-text-muted text-center">
              按 <KeyboardShortcutHint shortcut="?" className="mx-1" /> 或点击左下角图标打开此帮助
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
