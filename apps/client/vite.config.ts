import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "vitest/config";

// Web-only build: plain DOM and CSS through Vite. Nothing is aliased away — the
// router, camera, and photo-library adapters are ordinary modules under `src/`,
// and no part of the React Native or Expo toolchain is resolved or bundled.
export default defineConfig(({ command }) => {
  const production = command === "build";
  return {
    // The offline ONNX classifier is bundled as a URL asset, then handed to
    // onnxruntime-web at runtime (metro could not bundle it — the reason for Vite).
    assetsInclude: ["**/*.onnx"],
    base: process.env.VITE_BASE ?? "/",
    define: {
      // Track the actual command so the dev server keeps React's development
      // checks and the build strips them. A frozen "production" here would
      // silence dev warnings and the error overlay.
      __DEV__: JSON.stringify(!production),
      global: "globalThis",
      "process.env.NODE_ENV": JSON.stringify(production ? "production" : "development"),
    },
    plugins: [
      react(),
      // Tile art `.svg` imports become plain DOM <svg> React components.
      svgr({ include: "**/*.svg" }),
    ],
    // Component tests run against this same config, so a screen resolves its
    // adapters and tile art in a test exactly as it does in the browser.
    test: {
      css: { modules: { classNameStrategy: "non-scoped" } },
      environment: "jsdom",
      // A ratchet, not a target: these floors sit just under what the suite
      // reaches, so coverage cannot quietly slide. `npm run check` runs this
      // suite with coverage, so they are a gate rather than dormant config.
      //
      // Platform adapters and the WebMCP bridge stay outside the high floors on
      // purpose — they wrap ONNX, storage, the camera, and the browser's
      // model-context API, so a unit test would mostly assert that a mock was
      // called. The browser dogfood drives those for real instead.
      coverage: {
        include: ["src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
        provider: "v8",
        reportsDirectory: "../../coverage/client",
        thresholds: {
          "src/components/**": { branches: 100, functions: 100, lines: 100, statements: 100 },
          // Re-seated on 2026-08-03 when row splitting landed, from 78/92 to
          // 77/90. Two honest reasons, neither of them "the gate was in the way":
          // the splitter is a pixel loop whose `?? 0` guards are the
          // compiler-mandated kind described below and cannot be reached, and a
          // hand too short for the component locator now divides instead of
          // failing, so the gap-reading code it used to fall through to is
          // reached by fewer tests. Raise it again by covering that code, not by
          // deleting it.
          "src/features/recognition/**": { branches: 77, functions: 90, lines: 92, statements: 92 },
          "src/i18n/**": { branches: 90, functions: 100, lines: 100, statements: 100 },
          branches: 60,
          functions: 58,
          lines: 62,
          statements: 62,
        },
      },
      // Cleared, not reset: these suites set a port's behaviour once in its
      // `vi.mock` factory, and resetting would strip that between tests.
      clearMocks: true,
      include: ["src/**/*.test.ts?(x)", "tests/**/*.test.ts?(x)"],
      setupFiles: ["./tests/support/setup.ts"],
    },
  };
});
