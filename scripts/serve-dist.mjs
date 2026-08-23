import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";

const root = new URL("../dist/client/", import.meta.url);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };

createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = join(root.pathname.slice(1), relative);
  try {
    await stat(file);
    response.setHeader("content-type", types[extname(file)] ?? "application/octet-stream");
    createReadStream(file).pipe(response);
  } catch {
    response.statusCode = 404;
    response.end("Not found");
  }
}).listen(4173, "127.0.0.1", () => console.log("http://127.0.0.1:4173"));
