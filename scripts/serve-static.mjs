import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const root = resolve(process.cwd(), "apps/client/dist");
const host = process.env.RIICHIMI_HOST ?? "127.0.0.1";
const port = Number(process.env.RIICHIMI_PORT ?? "41731");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
]);

function candidatePaths(decodedPathname) {
  const relative = decodedPathname.replace(/^\/+|\/+$/g, "") || "index.html";
  const direct = resolve(root, relative);
  if (direct !== root && !direct.startsWith(`${root}${sep}`)) {
    return [];
  }
  return extname(direct) === ""
    ? [direct, `${direct}.html`, resolve(direct, "index.html")]
    : [direct];
}

async function findFile(pathname) {
  for (const candidate of candidatePaths(pathname)) {
    try {
      if ((await stat(candidate)).isFile()) {
        return candidate;
      }
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  }
  return null;
}

async function handleRequest(request, response) {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, {
        Allow: "GET, HEAD",
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end("Method not allowed");
      return;
    }

    const rawPathname = new URL(request.url ?? "/", `http://${host}:${port}`).pathname;
    let pathname;
    try {
      pathname = decodeURIComponent(rawPathname);
    } catch {
      // Malformed percent-encoding (e.g. "%ZZ") is a bad request, not a server fault.
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Bad request");
      return;
    }

    // A path with no extension is a client-side route: serve the SPA shell so
    // react-router can resolve it. Only missing assets (with an extension) 404.
    const file =
      (await findFile(pathname)) ??
      (extname(pathname) === "" ? await findFile("/index.html") : null);
    if (file === null) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes.get(extname(file)) ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    const stream = createReadStream(file);
    // A file removed between the stat and the read must not crash the server with
    // an unhandled stream error; abort the response instead.
    stream.on("error", () => {
      response.destroy();
    });
    stream.pipe(response);
  } catch {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Internal server error");
  }
}

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(port, host, () => {
  process.stdout.write(`Riichimi static export: http://${host}:${port}\n`);
});
