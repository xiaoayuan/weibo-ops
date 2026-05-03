"use client";

import { useEffect, useRef, useCallback, useState } from "react";

/**
 * WebSocket 消息类型
 */
export type WSMessageType =
  | "task:update"
  | "task:complete"
  | "log:new"
  | "account:update"
  | "plan:update"
  | "stats:update"
  | "subscribe"
  | "unsubscribe"
  | "auth";

/**
 * WebSocket 消息
 */
export interface WSMessage {
  type: WSMessageType;
  data?: unknown;
  timestamp?: number;
  channel?: string;
  userId?: string;
}

/**
 * WebSocket Hook 配置
 */
interface UseWebSocketOptions {
  url?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  onMessage?: (message: WSMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

// 模块级变量，供 setTimeout 回调访问最新 connect 函数
// 避免在 onclose 中直接引用 connect 导致循环依赖
const reconnectConnectFn = { current: (() => {}) as () => void };

/**
 * WebSocket Hook
 *
 * 提供 WebSocket 连接管理和消息处理
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = `ws://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:3009/ws`,
    reconnect = true,
    reconnectInterval = 3000,
    onMessage,
    onOpen,
    onClose,
    onError,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);

  /**
   * 连接 WebSocket
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log("✓ WebSocket 已连接");
        isConnectedRef.current = true;
        setIsConnected(true);
        onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          onMessage?.(message);
        } catch (error) {
          console.error("WebSocket 消息解析失败:", error);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket 已断开");
        isConnectedRef.current = false;
        setIsConnected(false);
        onClose?.();

        // 自动重连：setTimeout 回调在执行时从模块级变量读取最新的 connect 函数
        if (reconnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("尝试重新连接 WebSocket...");
            reconnectConnectFn.current();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket 错误:", error);
        onError?.(error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("WebSocket 连接失败:", error);
    }
  }, [url, reconnect, reconnectInterval, onMessage, onOpen, onClose, onError]);

  // 将 connect 函数存入模块级变量，供 reconnect 时使用
  // 通过 useEffect 更新，避免在渲染期间修改 ref
  useEffect(() => {
    reconnectConnectFn.current = connect;
  }, [connect]);

  /**
   * 断开连接
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    isConnectedRef.current = false;
    setIsConnected(false);
  }, []);

  /**
   * 发送消息
   */
  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket 未连接，无法发送消息");
    }
  }, []);

  /**
   * 订阅频道
   */
  const subscribe = useCallback((channel: string) => {
    send({ type: "subscribe", channel });
  }, [send]);

  /**
   * 取消订阅
   */
  const unsubscribe = useCallback((channel: string) => {
    send({ type: "unsubscribe", channel });
  }, [send]);

  /**
   * 认证
   */
  const auth = useCallback((userId: string) => {
    send({ type: "auth", userId });
  }, [send]);

  // 自动连接和清理
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    send,
    subscribe,
    unsubscribe,
    auth,
    isConnected,
    reconnect: connect,
    disconnect,
  };
}

/**
 * WebSocket 消息监听 Hook
 *
 * 监听特定类型的消息
 */
export function useWebSocketMessage(
  type: WSMessageType,
  callback: (data: unknown) => void,
) {
  useWebSocket({
    onMessage: (message) => {
      if (message.type === type) {
        callback(message.data);
      }
    },
  });
}