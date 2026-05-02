import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { proxyToLegacyBackend } from "./http/proxy";
import { CacheWarmup } from "./lib/cache-warmup";
import { wsManager } from "./lib/websocket";

const app = new Hono();

app.get("/", (c) => {
  return c.json({
    success: true,
    data: {
      service: "weibo-ops-api",
      mode: "proxy-first",
      message: "Standalone API service is running.",
    },
  });
});

app.get("/health", (c) => {
  return c.json({ success: true, status: "ok" });
});

app.get("/api", (c) => {
  return c.json({
    success: true,
    data: {
      service: "weibo-ops-api",
      legacyBackendOrigin: process.env.LEGACY_BACKEND_ORIGIN || "http://127.0.0.1:3007",
    },
  });
});

app.all("/api/*", async (c) => {
  return proxyToLegacyBackend(c.req.raw, c.req.path);
});

const port = Number(process.env.PORT || 3009);
const hostname = process.env.HOSTNAME || "0.0.0.0";

// 启动缓存预热
CacheWarmup.startScheduledWarmup();

// 启动服务器
const server = serve(
  {
    fetch: app.fetch,
    port,
    hostname,
  },
  (info) => {
    console.log(`weibo-ops-api listening on http://${info.address}:${info.port}`);
  },
);

// 初始化 WebSocket（使用底层 HTTP 服务器）
if (server && typeof server === "object" && "server" in server) {
  wsManager.initialize(server.server as any);
}
