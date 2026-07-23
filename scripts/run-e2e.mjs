import { spawn } from "node:child_process";
import { resolve } from "node:path";

const serverPath = resolve("scripts/serve-static.mjs");
const playwrightPath = resolve("node_modules/@playwright/test/cli.js");
const server = spawn(process.execPath, [serverPath], {
  stdio: ["ignore", "pipe", "inherit"],
});

let ready = false;
let readinessTimeout;

const readiness = new Promise((resolveReady, rejectReady) => {
  readinessTimeout = setTimeout(() => {
    rejectReady(new Error("Riichimi's static server did not become ready within 15 seconds."));
  }, 15_000);
  server.once("error", rejectReady);
  server.once("exit", (code) => {
    if (!ready) {
      rejectReady(new Error(`Riichimi's static server exited before testing with code ${code}.`));
    }
  });
  server.stdout.on("data", (chunk) => {
    const output = String(chunk);
    process.stdout.write(output);
    if (!ready && output.includes("Riichimi static export:")) {
      ready = true;
      clearTimeout(readinessTimeout);
      resolveReady();
    }
  });
});

function stopServer() {
  if (!server.killed) {
    server.kill("SIGTERM");
  }
}

process.once("SIGINT", () => {
  stopServer();
  process.exitCode = 130;
});
process.once("SIGTERM", () => {
  stopServer();
  process.exitCode = 143;
});

try {
  await readiness;
  const tests = spawn(process.execPath, [playwrightPath, "test", ...process.argv.slice(2)], {
    stdio: "inherit",
  });
  const exitCode = await new Promise((resolveExit, rejectExit) => {
    tests.once("error", rejectExit);
    tests.once("exit", (code) => resolveExit(code ?? 1));
  });
  process.exitCode = exitCode;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  clearTimeout(readinessTimeout);
  stopServer();
}
