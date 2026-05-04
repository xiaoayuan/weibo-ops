require("./server.js");

const http = require("http");

function pingSelf(retries = 0) {
  const req = http.get("http://127.0.0.1:3000/login", (res) => {
    res.resume();
    if (res.statusCode === 200) {
      console.log("[startup] scheduler trigger ok");
    } else if (retries < 10) {
      setTimeout(() => pingSelf(retries + 1), 3000);
    }
  });
  req.on("error", () => {
    if (retries < 10) {
      setTimeout(() => pingSelf(retries + 1), 3000);
    } else {
      console.error("[startup] scheduler trigger failed after 10 retries");
    }
  });
}

// Wait for server to be ready, then trigger
setTimeout(() => pingSelf(), 5000);
