/* A static file server for the test suites.
 *
 * Deliberately dependency-free: the product has no build step and no runtime
 * dependencies, and adding a web framework just to serve seven files would be
 * the first crack in that.
 *
 * Exported for test/run.js, and runnable on its own:
 *   node test/serve.js [port]
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  /* Chrome refuses a manifest served as anything else, and GitHub Pages sends
     this type too — so the local server has to match or the install check
     passes here and fails in production. */
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
};

function serve(port = 0) {
  const server = http.createServer((req, res) => {
    /* Strip the query and decode before touching the filesystem. */
    let rel;
    try {
      rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      res.writeHead(400).end("bad request");
      return;
    }
    if (rel.endsWith("/")) rel += "index.html";

    /* Resolve, then confirm the result is still inside ROOT. A test server is
       still a server, and "../../etc/passwd" should not work in one. */
    const file = path.resolve(ROOT, "." + rel);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
      res.writeHead(403).end("forbidden");
      return;
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { "content-type": "text/plain" }).end("not found");
        return;
      }
      res.writeHead(200, {
        "content-type": TYPES[path.extname(file)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const actual = server.address().port;
      resolve({
        port: actual,
        url: `http://127.0.0.1:${actual}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

module.exports = { serve };

if (require.main === module) {
  const port = Number(process.argv[2]) || 8099;
  serve(port).then((s) => console.log(`serving ${ROOT} at ${s.url}`));
}
