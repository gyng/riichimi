import { defineConfig } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [["list"]],
  testDir: "./e2e",
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:41731",
    browserName: "chromium",
    channel: "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
