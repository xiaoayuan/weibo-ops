import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";

/**
 * WebSocket 消息类型
 */
export type WSMessageType =
  | "task:update"
  | "task:complete"
  | "log:new"
  | "account:update"
  | "plan:update"
  | "stats:update";

/**
 * WebSocket 消息
 */
export interface WSMessage {
  type: WSMessageType;
  data: unknown;
  timestamp: number;
}

/**
 * WebSocket 客户端信息
 */
interface WSClient {
  ws: WebSocket;
  userId?: string;
  subscriptions: Set<string>;
}

/**
 * WebSocket 管理器
 * 
 * 提供实时推送功能，替代轮询机制
 */
export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, WSClient> = new Map();

  /**
   * 初始化 WebSocket 服务器
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: "/ws",
    });

    this.wss.on("connection", (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    console.log("✓ WebSocket 服务器已启动");
  }

  /**
   * 处理新连接
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const client: WSClient = {
      ws,
      subscriptions: new Set(),
    };

    this.clients.set(ws, client);

    console.log(`WebSocket 客户端已连接，当前连接数: ${this.clients.size}`);

    // 发送欢迎消息
    this.send(ws, {
      type: "stats:update",
      data: { message: "WebSocket 连接成功" },
      timestamp: Date.now(),
    });

    // 处理消息
    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        console.error("WebSocket 消息解析失败:", error);
      }
    });

    // 处理断开
    ws.on("close", () => {
      this.clients.delete(ws);
      console.log(`WebSocket 客户端已断开，当前连接数: ${this.clients.size}`);
    });

    // 处理错误
    ws.on("error", (error) => {
      console.error("WebSocket 错误:", error);
    });

    // 心跳检测 - 存储 timer 引用以便在 close 事件中清理
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);

    ws.on("pong", () => {
      // 客户端响应心跳
    });

    // 处理断开 - 确保 heartbeat 被清理，防止内存泄漏
    ws.on("close", () => {
      clearInterval(heartbeat);
      this.clients.delete(ws);
      console.log(`WebSocket 客户端已断开，当前连接数: ${this.clients.size}`);
    });
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(ws: WebSocket, message: any): void {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.type) {
      case "subscribe":
        // 订阅特定频道
        if (message.channel) {
          client.subscriptions.add(message.channel);
          console.log(`客户端订阅频道: ${message.channel}`);
        }
        break;

      case "unsubscribe":
        // 取消订阅
        if (message.channel) {
          client.subscriptions.delete(message.channel);
          console.log(`客户端取消订阅: ${message.channel}`);
        }
        break;

      case "auth":
        // 认证用户
        if (message.userId) {
          client.userId = message.userId;
          console.log(`客户端认证: ${message.userId}`);
        }
        break;

      default:
        console.log("未知消息类型:", message.type);
    }
  }

  /**
   * 发送消息给单个客户端
   */
  private send(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * 广播消息给所有客户端
   */
  broadcast(message: WSMessage): void {
    const data = JSON.stringify(message);
    
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    });
  }

  /**
   * 发送消息给特定频道的订阅者
   */
  broadcastToChannel(channel: string, message: WSMessage): void {
    const data = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (
        client.subscriptions.has(channel) &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        client.ws.send(data);
      }
    });
  }

  /**
   * 发送消息给特定用户
   */
  sendToUser(userId: string, message: WSMessage): void {
    const data = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (
        client.userId === userId &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        client.ws.send(data);
      }
    });
  }

  /**
   * 获取连接数
   */
  getConnectionCount(): number {
    return this.clients.size;
  }

  /**
   * 关闭所有连接
   */
  close(): void {
    this.clients.forEach((client) => {
      client.ws.close();
    });
    this.clients.clear();
    this.wss?.close();
    console.log("WebSocket 服务器已关闭");
  }
}

// 导出单例
export const wsManager = new WebSocketManager();
