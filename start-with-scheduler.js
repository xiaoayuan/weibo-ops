const http = require("http");

// Self-trigger the legacy app root layout to start scheduler + dispatcher
function triggerSelf() {
  const req = http.get("http://127.0.0.1:3000/login", (res) => {
    res.resume();
    console.log("[startup] scheduler trigger sent, status:", res.statusCode);
  });
  req.on("error", () => {
    setTimeout(triggerSelf, 3000);
  });
}

// Wait for Next.js server to be ready, then trigger
setTimeout(triggerSelf, 5000);

// Start Next.js server
require("./server.js");
