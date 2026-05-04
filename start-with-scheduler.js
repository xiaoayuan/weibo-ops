require("./server.js");

const http = require("http");

function pingSelf() {
  http.get("http://127.0.0.1:3000/login", (res) => res.resume())
    .on("error", () => {});
}

// Trigger after server ready, then every 2 minutes to ensure scheduler stays alive
setTimeout(pingSelf, 8000);
setInterval(pingSelf, 2 * 60 * 1000);
