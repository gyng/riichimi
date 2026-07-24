// Capture the README screenshots by driving the built app, not by hand.
//
// Every shot comes from the same flows a player uses, so the images cannot drift
// away from the interface: if a control is renamed or a screen is restructured,
// this fails rather than quietly producing a stale picture.
//
// Usage: npm run build:web && node scripts/screenshots/capture.mjs

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "@playwright/test";

const OUTPUT = resolve("docs/screenshots");
const PHONE = { height: 844, width: 390 };
const DESKTOP = { height: 900, width: 1280 };

function startServer() {
  const server = spawn(process.execPath, [resolve("scripts/serve-static.mjs")], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  const url = new Promise((resolveUrl, rejectUrl) => {
    const timeout = setTimeout(
      () => rejectUrl(new Error("Static server never became ready.")),
      15_000,
    );
    server.stdout.on("data", (chunk) => {
      const match = /(http:\/\/\S+)/.exec(String(chunk));
      if (match?.[1] !== undefined) {
        clearTimeout(timeout);
        resolveUrl(match[1].trim());
      }
    });
    server.once("exit", (code) => rejectUrl(new Error(`Static server exited with ${code}.`)));
  });
  return { server, url };
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUTPUT}/${name}.png`, scale: "css" });
  process.stdout.write(`  ${name}.png\n`);
}

/** Start from a known state so a shot never depends on a previous run. */
async function open(page, base, path, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${base}${path}`);
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.goto(`${base}${path}`);
}

async function capture(base) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });

  try {
    await open(page, base, "/", PHONE);
    await shot(page, "home");

    // A scored hand: the worked example, calculated, showing real tile faces.
    await open(page, base, "/manual", PHONE);
    await page.getByRole("button", { name: "Try a scored example" }).click();
    await page.getByRole("button", { name: "Calculate maximum score" }).click();
    const phoneScore = page.getByText("2 han · 20 fu").filter({ visible: true }).first();
    await phoneScore.waitFor();
    // Frame the audit, which is the point of the screen.
    await phoneScore.evaluate((element) => element.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(250);
    await shot(page, "calculator");

    // The offline recognizer reading the bundled sample, gated on review.
    await open(page, base, "/scan", PHONE);
    await page.getByRole("button", { name: "Try a sample hand" }).click();
    await page.getByText(/tiles read · \d+ need review/).waitFor({ timeout: 60_000 });
    await shot(page, "scan-review");

    // A live four-player table.
    await open(page, base, "/session", PHONE);
    await page.getByRole("button", { name: "Start East 1" }).click();
    await page.getByRole("heading", { name: "East 1" }).waitFor();
    await shot(page, "table");

    // Rulesets and house rules.
    await open(page, base, "/settings", PHONE);
    await page.getByRole("radio", { name: "House rules" }).click();
    await page.getByText("Rules your table plays by").waitFor();
    await shot(page, "rules");

    // The same calculator with room to breathe, showing the two-column layout.
    await open(page, base, "/manual", DESKTOP);
    await page.getByRole("button", { name: "Try a scored example" }).click();
    await page.getByRole("button", { name: "Calculate maximum score" }).click();
    // Frame the top, where the hand and the picker sit side by side.
    await page.getByText("2 han · 20 fu").filter({ visible: true }).first().waitFor();
    await page.getByRole("heading", { name: "Score a hand" }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await shot(page, "calculator-wide");
  } finally {
    await browser.close();
  }
}

const { server, url } = startServer();
try {
  await mkdir(OUTPUT, { recursive: true });
  const base = await url;
  process.stdout.write(`Capturing from ${base}\n`);
  await capture(base);
  process.stdout.write("Screenshots written to docs/screenshots\n");
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
}
