require("./server.js");

const http = require("http");

// 启动调度器和任务分发器（仅 controller/worker 角色运行）
const role = process.env.NODE_ROLE || "controller";
if (role === "controller" || role === "worker") {
  // standalone 构建把 server 代码编译到 .next/server/ 目录下
  // 从 /app/start-with-scheduler.js 引用就是 ./.next/server/auto-start
  const { ensureSchedulerStarted } = require("./.next/server/auto-start");
  ensureSchedulerStarted();
  console.log("[start-with-scheduler] Scheduler auto-start initialized, role:", role);
}

function ping() {
  http.get("http://127.0.0.1:3000/login", (r) => r.resume()).on("error", () => {});
}
setTimeout(ping, 5000);
setInterval(ping, 2 * 60 * 1000);
