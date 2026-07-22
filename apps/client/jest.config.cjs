module.exports = {
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  coverageDirectory: "../../coverage/client",
  preset: "jest-expo",
  testMatch: ["<rootDir>/src/**/*.test.ts?(x)", "<rootDir>/tests/**/*.test.ts?(x)"],
};
