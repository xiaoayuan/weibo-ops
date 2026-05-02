"use client";

import { useEffect, useState } from "react";
import { useWebSocket, type WSMessage } from "@/lib/hooks/use-websocket";

/**
 * WebSocket 状态指示器
 * 
 * 显示 WebSocket 连接状态和实时消息
 */
export function WebSocketIndicator() {
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const { subscribe, unsubscribe } = useWebSocket({
    onMessage: (message) => {
      setMessages((prev) => [...prev.slice(-9), message]);
    },
    onOpen: () => {
      setIsConnected(true);
    },
    onClose: () => {
      setIsConnected(false);
    },
  });

  useEffect(() => {
    // 订阅所有频道
    subscribe("tasks");
    subscribe("logs");
    subscribe("stats");

    return () => {
      unsubscribe("tasks");
      unsubscribe("logs");
      unsubscribe("stats");
    };
  }, [subscribe, unsubscribe]);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* 连接状态指示器 */}
      <div className="flex items-center gap-2 bg-app-panel-strong rounded-full px-4 py-2 shadow-lg border border-app-line">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-app-success animate-pulse" : "bg-app-text-muted"
          }`}
        />
        <span className="text-xs text-app-text-soft">
          {isConnected ? "实时连接" : "已断开"}
        </span>
      </div>

      {/* 最近消息（开发模式） */}
      {process.env.NODE_ENV === "development" && messages.length > 0 && (
        <div className="mt-2 bg-app-panel-strong rounded-lg p-3 shadow-lg border border-app-line max-w-sm">
          <div className="text-xs font-medium text-app-text-strong mb-2">
            最近消息
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {messages.map((msg, i) => (
              <div
                key={i}
                className="text-xs text-app-text-muted font-mono truncate"
              >
                {msg.type}: {JSON.stringify(msg.data).slice(0, 50)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
