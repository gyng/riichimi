module.exports = {
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  coverageDirectory: "../../coverage/client",
  // Tile art is compiled by react-native-svg-transformer under Metro, which Jest
  // does not use; the mock keeps the component tree renderable in tests.
  moduleNameMapper: { "\\.svg$": "<rootDir>/tests/support/svg-mock.tsx" },
  preset: "jest-expo",
  testMatch: ["<rootDir>/src/**/*.test.ts?(x)", "<rootDir>/tests/**/*.test.ts?(x)"],
};
