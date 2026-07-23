import { expect, test, type Page } from "@playwright/test";

interface TestWebMcpTool {
  readonly execute: (input: Record<string, unknown>) => unknown;
  readonly name: string;
}

interface TestWebMcpHarness {
  execute(name: string, input?: Record<string, unknown>): Promise<unknown>;
  names(): readonly string[];
}

declare global {
  interface Window {
    richiiWebMcpTest: TestWebMcpHarness;
  }
}

async function installWebMcpHarness(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const tools = new Map<string, TestWebMcpTool>();
    const modelContext = {
      registerTool: async (tool: TestWebMcpTool, options?: { signal?: AbortSignal }) => {
        tools.set(tool.name, tool);
        options?.signal?.addEventListener("abort", () => {
          if (tools.get(tool.name) === tool) {
            tools.delete(tool.name);
          }
        });
      },
    };

    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: modelContext,
    });
    Object.defineProperty(window, "richiiWebMcpTest", {
      configurable: true,
      value: {
        execute: async (name: string, input: Record<string, unknown> = {}) => {
          const tool = tools.get(name);
          if (tool === undefined) {
            throw new Error(`WebMCP tool ${name} is not registered.`);
          }
          return tool.execute(input);
        },
        names: () => [...tools.keys()],
      } satisfies TestWebMcpHarness,
    });
  });
}

async function executeTool(
  page: Page,
  name: string,
  input: Record<string, unknown> = {},
): Promise<unknown> {
  return page.evaluate(
    async ({ toolInput, toolName }) => window.richiiWebMcpTest.execute(toolName, toolInput),
    { toolInput: input, toolName: name },
  );
}

test("dogfoods the polished mobile scoring and table flows through WebMCP", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await installWebMcpHarness(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Read the table/ })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.richiiWebMcpTest.names()))
    .toEqual(
      expect.arrayContaining([
        "richii.app.get_state",
        "richii.app.navigate",
        "richii.session.start",
      ]),
    );
  await page.screenshot({ fullPage: true, path: "docs/checkpoints/2026-07-23-01-home-mobile.png" });

  await executeTool(page, "richii.app.navigate", { destination: "manual" });
  await expect(page).toHaveURL(/\/manual$/);
  await expect
    .poll(() => page.evaluate(() => window.richiiWebMcpTest.names()))
    .toContain("richii.manual.load_example");
  await executeTool(page, "richii.manual.load_example");
  await expect(page.getByText(/14 of 14 concealed tiles/)).toBeVisible();
  const scoreResult = await executeTool(page, "richii.manual.calculate");
  expect(scoreResult).toMatchObject({ structuredContent: { kind: "success" } });
  const mobileScore = page.getByText("2 han · 20 fu").filter({ visible: true });
  await expect(mobileScore).toBeVisible();
  await mobileScore.scrollIntoViewIfNeeded();
  await page.screenshot({
    fullPage: true,
    path: "docs/checkpoints/2026-07-23-02-manual-score-mobile.png",
  });

  const historyResult = await executeTool(page, "richii.history.list");
  expect(historyResult).toMatchObject({
    structuredContent: {
      entries: [
        {
          hand: { winningTile: "4s" },
          result: { fu: 20, han: 2, totalGain: 1500 },
          rules: { id: "wrc-2025" },
        },
      ],
    },
  });
  await executeTool(page, "richii.app.navigate", { destination: "history" });
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole("heading", { name: "Every answer leaves a trail." })).toBeVisible();
  await expect(page.getByText("Fully concealed hand").filter({ visible: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("2 han · 20 fu").filter({ visible: true })).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: "docs/checkpoints/2026-07-23-05-score-history-mobile.png",
  });

  await executeTool(page, "richii.session.start", {
    playerNames: ["Aiko", "Beni", "Chika", "Daichi"],
  });
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole("heading", { name: "East 1" })).toBeVisible();
  await executeTool(page, "richii.session.declare_riichi", { playerIndex: 1 });
  await expect(page.getByText("24,000", { exact: true }).filter({ visible: true })).toBeVisible();
  await executeTool(page, "richii.session.record_draw", { tenpaiPlayerIndices: [0, 2] });
  await expect(
    page.getByText("26,500", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Exhaustive draw").filter({ visible: true }).last()).toBeVisible();
  await executeTool(page, "richii.session.undo");
  await expect(page.getByText("24,000", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("No completed rounds yet.").filter({ visible: true })).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: "docs/checkpoints/2026-07-23-03-session-mobile.png",
  });

  await page.getByRole("button", { name: "Score a winning hand" }).click();
  await expect(page).toHaveURL(/\/manual$/);
  await expect(page.getByText("ACTIVE TABLE · CONTEXT LINKED")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.richiiWebMcpTest.names()))
    .toContain("richii.manual.load_example");
  await executeTool(page, "richii.manual.load_example");
  await executeTool(page, "richii.manual.calculate");
  await expect(page.getByText("Score checked. Ready to update the table.")).toBeVisible();
  const recordedWin = await executeTool(page, "richii.manual.record_table_result");
  expect(recordedWin).toMatchObject({
    structuredContent: {
      discarderIndex: null,
      payments: { kind: "tsumo" },
      winnerIndex: 0,
    },
  });
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole("heading", { name: "East 1" })).toBeVisible();
  await expect(page.getByLabel("1 honba, 0 riichi sticks").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("28,100", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Aiko won").filter({ visible: true })).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: "docs/checkpoints/2026-07-23-07-session-scored-win-mobile.png",
  });
});

test("dogfoods visible desktop scoring and camera recovery without an agent", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto("/");
  const faviconResponse = await page.request.get("/favicon.ico");
  expect(faviconResponse.ok()).toBe(true);

  await page.getByRole("button", { name: "Enter tiles manually" }).click();
  await expect(page).toHaveURL(/\/manual$/);
  await page.getByRole("button", { name: "Try a scored example" }).click();
  await page.getByRole("button", { name: "Calculate maximum score" }).click();
  const desktopScore = page.getByText("2 han · 20 fu").filter({ visible: true });
  await expect(desktopScore).toBeVisible();
  await desktopScore.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/checkpoints/2026-07-23-04-manual-score-desktop.png",
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Revisit recent answers" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByText("2 han · 20 fu").filter({ visible: true })).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Scan a winning hand" }).click();
  await expect(page).toHaveURL(/\/scan$/);
  await expect(page.getByRole("heading", { name: /Show us the tiles/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter tiles manually" })).toBeVisible();
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose an existing photo" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles("e2e/fixtures/guided-hand.png");
  await expect(page.getByText("Photo ready for review")).toBeVisible();
  await page.screenshot({ path: "docs/checkpoints/2026-07-23-06-gallery-review-desktop.png" });
  await page.getByRole("button", { name: "Read 14 tiles offline" }).click();
  await expect(page.getByText(/15 tiles read · \d+ need review/)).toBeVisible({ timeout: 30_000 });
  await page.screenshot({
    path: "docs/checkpoints/2026-07-23-08-offline-recognition-review-desktop.png",
  });
  const reviewedTiles = [
    ["Hand tile 1", "1 characters"],
    ["Hand tile 2", "2 characters"],
    ["Hand tile 3", "3 characters"],
    ["Hand tile 4", "4 characters"],
    ["Hand tile 5", "5 characters"],
    ["Hand tile 6", "6 characters"],
    ["Hand tile 7", "7 circles"],
    ["Hand tile 8", "8 circles"],
    ["Hand tile 9", "9 circles"],
    ["Hand tile 10", "2 bamboo"],
    ["Hand tile 11", "3 bamboo"],
    ["Winning tile 12", "4 bamboo"],
    ["Hand tile 13", "5 circles"],
    ["Hand tile 14", "5 circles"],
    ["Dora indicator", "9 bamboo"],
  ] as const;
  for (const [position, tile] of reviewedTiles) {
    await page.getByRole("button", { name: new RegExp(`^${position},`) }).click();
    await page.getByRole("button", { name: "Choose from all tiles" }).click();
    await page.getByRole("button", { exact: true, name: tile }).click();
  }
  const completedReview = page.getByRole("heading", { name: "Recognition review complete" });
  await expect(completedReview).toBeVisible();
  await completedReview.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/checkpoints/2026-07-23-10-recognition-review-complete-desktop.png",
  });
  await page.getByRole("button", { name: "Continue with reviewed tiles" }).click();
  await expect(page).toHaveURL(/\/manual\?.*recognizedTiles=/);
  await expect(page.getByLabel("Captured hand reference")).toBeVisible();
  await expect(page.getByText("OFFLINE RECOGNITION · REVIEW REQUIRED")).toBeVisible();
  await expect(page.getByText(/15 uncertain reads were confirmed or corrected/)).toBeVisible();
  await expect(page.getByText(/14 of 14 concealed tiles/)).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: "docs/checkpoints/2026-07-23-09-recognized-draft-desktop.png",
  });
});
