import { wsManager, type WSMessage, type WSMessageType } from "./websocket";

/**
 * WebSocket 推送工具
 * 
 * 提供便捷的方法来推送各种类型的消息
 */
export class WSPusher {
  /**
   * 推送任务更新
   */
  static pushTaskUpdate(taskId: string, data: unknown): void {
    wsManager.broadcastToChannel("tasks", {
      type: "task:update",
      data: { taskId, ...data },
      timestamp: Date.now(),
    });
  }

  /**
   * 推送任务完成
   */
  static pushTaskComplete(taskId: string, result: unknown): void {
    wsManager.broadcastToChannel("tasks", {
      type: "task:complete",
      data: { taskId, result },
      timestamp: Date.now(),
    });
  }

  /**
   * 推送新日志
   */
  static pushNewLog(log: unknown): void {
    wsManager.broadcastToChannel("logs", {
      type: "log:new",
      data: log,
      timestamp: Date.now(),
    });
  }

  /**
   * 推送账号更新
   */
  static pushAccountUpdate(accountId: string, data: unknown): void {
    wsManager.broadcast({
      type: "account:update",
      data: { accountId, ...data },
      timestamp: Date.now(),
    });
  }

  /**
   * 推送计划更新
   */
  static pushPlanUpdate(planId: string, data: unknown): void {
    wsManager.broadcast({
      type: "plan:update",
      data: { planId, ...data },
      timestamp: Date.now(),
    });
  }

  /**
   * 推送统计数据更新
   */
  static pushStatsUpdate(stats: unknown): void {
    wsManager.broadcastToChannel("stats", {
      type: "stats:update",
      data: stats,
      timestamp: Date.now(),
    });
  }

  /**
   * 推送自定义消息
   */
  static push(type: WSMessageType, data: unknown, channel?: string): void {
    const message: WSMessage = {
      type,
      data,
      timestamp: Date.now(),
    };

    if (channel) {
      wsManager.broadcastToChannel(channel, message);
    } else {
      wsManager.broadcast(message);
    }
  }

  /**
   * 推送给特定用户
   */
  static pushToUser(userId: string, type: WSMessageType, data: unknown): void {
    wsManager.sendToUser(userId, {
      type,
      data,
      timestamp: Date.now(),
    });
  }
}
