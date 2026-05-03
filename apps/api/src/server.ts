import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { proxyToLegacyBackend } from "./http/proxy";
import { CacheWarmup } from "./lib/cache-warmup";
import { wsManager } from "./lib/websocket";

/**
 * 安全响应头中间件
 */
const securityHeaders = [
  ["X-DNS-Prefetch-Control", "on"],
  ["X-Frame-Options", "DENY"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["X-XSS-Protection", "1; mode=block"],
  ["Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"],
];

const app = new Hono();

// 应用安全响应头到所有响应
app.use("*", async (c, next) => {
  await next();
  for (const [key, value] of securityHeaders) {
    c.res.headers.set(key, value);
  }
});

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

// 触发旧版应用启动调度器
const legacyOrigin = process.env.LEGACY_BACKEND_ORIGIN || "http://127.0.0.1:3007";
setTimeout(() => {
  fetch(`${legacyOrigin}/login`, { method: "HEAD" }).catch(() => {});
}, 2000);

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wsManager.initialize(server.server as any);
}
