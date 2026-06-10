import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = resolve("dist");
const port = Number(process.env.PORT || 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  const cleanPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const target = resolve(join(root, cleanPath));

  if (!target.startsWith(root) || !existsSync(target)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "content-type": types[extname(target)] || "application/octet-stream" });
  createReadStream(target).pipe(res);
});

server.listen(port, () => {
  console.log(`TousLesMatchs local: http://localhost:${port}`);
});
