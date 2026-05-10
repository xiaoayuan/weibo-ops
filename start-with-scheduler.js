/* eslint-disable @typescript-eslint/no-require-imports */
require("./server.js");

const http = require("http");

function ping(retry = 0) {
  const req = http.get("http://127.0.0.1:3000/login", (r) => {
    r.resume();
    console.log("[startup] ping ok, status:", r.statusCode);
  });
  req.on("error", () => {
    if (retry < 5) {
      setTimeout(() => ping(retry + 1), 5000);
    } else {
      console.error("[startup] ping failed after 5 retries");
    }
  });
}

setTimeout(() => ping(), 8000);
setInterval(() => ping(), 2 * 60 * 1000);
