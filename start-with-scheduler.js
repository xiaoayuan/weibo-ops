require("./server.js");

const http = require("http");

// 启动调度器和任务分发器（仅 controller/worker 角色运行）
const role = process.env.NODE_ROLE || "controller";
if (role === "controller" || role === "worker") {
  // 动态引入 auto-start，它会在内部调用 ensureUserAutomationSchedulerStarted 和 ensureActionJobDispatcherStarted
  const { ensureSchedulerStarted } = require("./src/server/auto-start");
  ensureSchedulerStarted();
  console.log("[start-with-scheduler] Scheduler auto-start initialized, role:", role);
}

function ping() {
  http.get("http://127.0.0.1:3000/login", (r) => r.resume()).on("error", () => {});
}
setTimeout(ping, 5000);
setInterval(ping, 2 * 60 * 1000);
