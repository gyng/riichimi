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
    riichimiWebMcpTest: TestWebMcpHarness;
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
    Object.defineProperty(window, "riichimiWebMcpTest", {
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
    async ({ toolInput, toolName }) => window.riichimiWebMcpTest.execute(toolName, toolInput),
    { toolInput: input, toolName: name },
  );
}

test("dogfoods the polished mobile scoring and table flows through WebMCP", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await installWebMcpHarness(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Score a winning hand/ })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.riichimiWebMcpTest.names()))
    .toEqual(
      expect.arrayContaining([
        "riichimi.app.get_state",
        "riichimi.app.navigate",
        "riichimi.rules.select",
        "riichimi.session.start",
      ]),
    );
  await page.screenshot({ fullPage: true, path: "docs/checkpoints/2026-07-23-01-home-mobile.png" });

  await executeTool(page, "riichimi.app.navigate", { destination: "manual" });
  await expect(page).toHaveURL(/\/manual$/);
  await expect
    .poll(() => page.evaluate(() => window.riichimiWebMcpTest.names()))
    .toContain("riichimi.manual.load_example");
  await executeTool(page, "riichimi.manual.load_example");
  await expect(page.getByText(/14\/14 ·/)).toBeVisible();
  const scoreResult = await executeTool(page, "riichimi.manual.calculate");
  expect(scoreResult).toMatchObject({ structuredContent: { kind: "success" } });
  const mobileScore = page.getByText("2 han · 20 fu").filter({ visible: true });
  await expect(mobileScore).toBeVisible();
  await mobileScore.scrollIntoViewIfNeeded();
  await page.screenshot({
    fullPage: true,
    path: "docs/checkpoints/2026-07-23-02-manual-score-mobile.png",
  });

  const historyResult = await executeTool(page, "riichimi.history.list");
  expect(historyResult).toMatchObject({
    structuredContent: {
      entries: [
        {
          hand: { winningTile: "4s" },
          result: { fu: 20, han: 2, totalGain: 1500 },
          rules: { id: "tenhou-hanchan" },
        },
      ],
    },
  });
  await executeTool(page, "riichimi.app.navigate", { destination: "history" });
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(page.getByText("Fully concealed hand").filter({ visible: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("2 han · 20 fu").filter({ visible: true })).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: "docs/checkpoints/2026-07-23-05-score-history-mobile.png",
  });

  const selectedRules = await executeTool(page, "riichimi.rules.select", {
    profileId: "wrc-2025-red-five-table",
  });
  expect(selectedRules).toMatchObject({
    structuredContent: { rules: { id: "wrc-2025-red-five-table", redFives: true } },
  });
  await expect
    .poll(async () => {
      const state = await executeTool(page, "riichimi.app.get_state");
      if (typeof state !== "object" || state === null || !("structuredContent" in state)) {
        return undefined;
      }
      const structuredContent = state.structuredContent;
      if (
        typeof structuredContent !== "object" ||
        structuredContent === null ||
        !("rules" in structuredContent)
      ) {
        return undefined;
      }
      const stateRules = structuredContent.rules;
      return typeof stateRules === "object" && stateRules !== null && "id" in stateRules
        ? stateRules.id
        : undefined;
    })
    .toBe("wrc-2025-red-five-table");
  const startedTable = await executeTool(page, "riichimi.session.start", {
    playerNames: ["Aiko", "Beni", "Chika", "Daichi"],
  });
  expect(startedTable).toMatchObject({
    structuredContent: { rulesProfileId: "wrc-2025-red-five-table" },
  });
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole("heading", { name: "East 1" })).toBeVisible();
  await expect(page.getByText("WRC 2025 · RED-FIVE TABLE · PINNED")).toBeVisible();
  await executeTool(page, "riichimi.session.declare_riichi", { playerIndex: 1 });
  await expect(page.getByText("24,000", { exact: true }).filter({ visible: true })).toBeVisible();
  await executeTool(page, "riichimi.session.record_draw", { tenpaiPlayerIndices: [0, 2] });
  await expect(
    page.getByText("26,500", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Exhaustive draw").filter({ visible: true }).last()).toBeVisible();
  await executeTool(page, "riichimi.session.undo");
  await expect(page.getByText("24,000", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("No completed rounds yet.").filter({ visible: true })).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: "docs/checkpoints/2026-07-23-03-session-mobile.png",
  });

  await page.getByRole("button", { name: "Score a hand" }).click();
  await expect(page).toHaveURL(/\/manual$/);
  await expect(page.getByText("ACTIVE TABLE · CONTEXT LINKED")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.riichimiWebMcpTest.names()))
    .toContain("riichimi.manual.load_example");
  await executeTool(page, "riichimi.manual.load_example");
  await executeTool(page, "riichimi.manual.calculate");
  await expect(page.getByText("Score checked. Ready to update the table.")).toBeVisible();
  const recordedWin = await executeTool(page, "riichimi.manual.record_table_result");
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
  // "East 1 · Aiko won" (history) vs "Edit East 1, Aiko won" (edit button) both
  // contain "Aiko won"; assert the history entry exactly to stay unambiguous.
  await expect(
    page.getByText("East 1 · Aiko won", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
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

  // Rules are setup, so they live on Setup rather than beside the tile picker.
  await page.getByRole("link", { name: "Setup" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole("radio", { name: "WRC 2025 · red-five table" }).click();
  await expect(page.getByRole("radio", { name: "WRC 2025 · red-five table" })).toBeChecked();
  await page.reload();
  await expect(page.getByRole("radio", { name: "WRC 2025 · red-five table" })).toBeChecked();

  await page.getByRole("link", { name: "Manual" }).click();
  await expect(page).toHaveURL(/\/manual$/);
  await expect(page.getByRole("button", { name: "red five characters" })).toBeVisible();
  await page.getByRole("button", { name: "Try a scored example" }).click();
  await page.getByRole("button", { name: "Calculate" }).click();
  const desktopScore = page.getByText("2 han · 20 fu").filter({ visible: true });
  await expect(desktopScore).toBeVisible();
  await desktopScore.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/checkpoints/2026-07-23-04-manual-score-desktop.png",
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Saved scores" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByText("2 han · 20 fu").filter({ visible: true })).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Scan a hand" }).click();
  await expect(page).toHaveURL(/\/scan$/);
  await expect(page.getByRole("heading", { name: /Show us the tiles/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter tiles manually" })).toBeVisible();
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose an existing photo" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles("e2e/fixtures/guided-hand-blurred.png");
  await expect(page.getByText("Photo ready for review")).toBeVisible();
  // These fixtures stage the hand as separate rows, so read them with the guided
  // layout (persists across the retake below).
  await page.getByRole("radio", { name: "Guided" }).click();
  // Reading starts on its own; selecting a layout re-reads the same photo.
  await expect(page.getByText(/photo is too blurry to read safely/)).toBeVisible();
  await page.screenshot({
    path: "docs/checkpoints/2026-07-23-14-blur-recovery-guidance-desktop.png",
  });

  const replacementChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose another photo" }).click();
  const replacementChooser = await replacementChooserPromise;
  await replacementChooser.setFiles("e2e/fixtures/guided-hand.png");
  await expect(page.getByText("Photo ready for review")).toBeVisible();
  await page.screenshot({ path: "docs/checkpoints/2026-07-23-06-gallery-review-desktop.png" });
  await expect(page.getByText("15 tiles read · 2 need review")).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("button", { name: /^Hand tile 1, 1 characters, \d+ percent confidence$/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/checkpoints/2026-07-23-11-v1-recognition-review-desktop.png",
  });
  const reviewedTiles = [
    ["Hand tile 2", "2 characters"],
    ["Hand tile 5", "5 characters"],
  ] as const;
  for (const [position, tile] of reviewedTiles) {
    await page.getByRole("button", { name: new RegExp(`^${position},`) }).click();
    await page.getByRole("button", { name: `Use ${tile} for selected tile` }).click();
  }
  const completedReview = page.getByRole("heading", { name: "Recognition review complete" });
  await expect(completedReview).toBeVisible();
  await completedReview.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/checkpoints/2026-07-23-12-v1-recognition-complete-desktop.png",
  });
  await page.getByRole("button", { name: "Continue with reviewed tiles" }).click();
  await expect(page).toHaveURL(/\/manual\?.*recognizedTiles=/);
  await expect(page.getByLabel("Captured hand reference")).toBeVisible();
  await expect(page.getByText("OFFLINE RECOGNITION · REVIEW REQUIRED")).toBeVisible();
  await expect(page.getByText(/^2 corrected · check against the photo\.$/)).toBeVisible();
  await expect(page.getByText(/14\/14 ·/)).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: "docs/checkpoints/2026-07-23-13-v1-recognized-draft-desktop.png",
  });
});

// The reviewer's path on a desktop with no camera: the bundled sample must resolve
// as a loadable asset on web and run the real offline recognizer. A regression here
// previously broke the whole /scan route.
test("reviews the scan flow on a desktop without a camera", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto("/");

  await page.getByRole("link", { name: "Scan" }).click();
  await expect(page).toHaveURL(/\/scan$/);

  await page.getByRole("button", { name: "Try a sample hand" }).click();
  await expect(page.getByText("Photo ready for review")).toBeVisible();
  // The bundled sample is staged as rows, so it selects the guided layout.
  await expect(page.getByRole("radio", { name: "Guided" })).toBeChecked();

  await expect(page.getByText(/tiles read · \d+ need review/)).toBeVisible({ timeout: 30_000 });
});
