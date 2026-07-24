module.exports = {
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  coverageDirectory: "../../coverage/client",
  // A ratchet, not a target. The global floor sits just under what the suite
  // reaches today so coverage cannot quietly slide; the per-area floors are
  // where behaviour actually lives and are held high deliberately.
  //
  // Platform adapters (infrastructure) and the WebMCP bridge stay outside the
  // high floors on purpose: they wrap ONNX, Expo storage, and the browser's
  // model-context API, so a unit test would mostly assert that a mock was
  // called. The browser dogfood drives all three for real instead.
  coverageThreshold: {
    "./src/components/": { branches: 100, functions: 100, lines: 100, statements: 100 },
    "./src/features/recognition/": { branches: 78, functions: 92, lines: 92, statements: 92 },
    "./src/i18n/": { branches: 90, functions: 100, lines: 100, statements: 100 },
    global: { branches: 55, functions: 49, lines: 57, statements: 56 },
  },
  // Tile art is compiled by react-native-svg-transformer under Metro, which Jest
  // does not use; the mock keeps the component tree renderable in tests.
  moduleNameMapper: { "\\.svg$": "<rootDir>/tests/support/svg-mock.tsx" },
  preset: "jest-expo",
  testMatch: ["<rootDir>/src/**/*.test.ts?(x)", "<rootDir>/tests/**/*.test.ts?(x)"],
};
