import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.json",
    },
    coverage: {
      provider: "v8",
      enabled: true,
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/**/index.ts",
        "src/**/*.d.ts",
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
    restoreMocks: true,
    mockReset: true,
    clearMocks: true,
    isolate: true,
  },
});
