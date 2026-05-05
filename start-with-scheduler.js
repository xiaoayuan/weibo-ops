require("./server.js");

const http = require("http");

function ping() {
  http.get("http://127.0.0.1:3000/login", (r) => r.resume()).on("error", () => {});
}

// 容器启动后立即预热，触发 layout.tsx 中的调度器启动
// 调度器使用全局锁，不会重复启动
setTimeout(ping, 3000);
setInterval(ping, 2 * 60 * 1000);
