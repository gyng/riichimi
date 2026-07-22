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
      thresholds: {
        branches: 85,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
    include: ["packages/**/*.test.ts"],
    mockReset: true,
    restoreMocks: true,
  },
});
