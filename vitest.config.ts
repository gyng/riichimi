import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/*.test.ts", "**/index.ts", "packages/rules/**", "packages/ui/**"],
      include: [
        "packages/score-core/src/**/*.ts",
        "packages/session-core/src/**/*.ts",
        "packages/vision/src/**/*.ts",
      ],
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Held just under what the suite reaches, so a regression trips the gate.
      // The last uncovered statements are compiler-mandated `undefined` guards
      // inside bounded loops and `never` exhaustiveness defaults: unreachable by
      // construction, and faking a call to them would test nothing.
      thresholds: {
        branches: 93,
        functions: 100,
        lines: 97,
        statements: 97,
      },
    },
    include: ["packages/**/*.test.ts"],
    mockReset: true,
    restoreMocks: true,
  },
});
