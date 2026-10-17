const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "dist");
const port = 4173;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/DESMAS") {
    res.writeHead(302, { Location: "/DESMAS/" });
    res.end();
    return;
  }
  if (!pathname.startsWith("/DESMAS/")) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  let rel = pathname.slice("/DESMAS/".length);
  if (rel === "") rel = "index.html";
  const file = path.resolve(root, rel);
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("missing");
      return;
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(port, "127.0.0.1");
