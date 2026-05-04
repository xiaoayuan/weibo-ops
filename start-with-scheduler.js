require("./server.js");

const http = require("http");
function ping() { http.get("http://127.0.0.1:3000/login", (r) => r.resume()).on("error", () => {}); }
setTimeout(ping, 5000);
setInterval(ping, 2 * 60 * 1000);
