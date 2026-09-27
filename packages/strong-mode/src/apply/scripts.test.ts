import { describe, expect, it } from "vitest";
import { scriptRunsVitest } from "./scripts.js";

describe("scriptRunsVitest", (): void => {
  it.each(["vitest run", "npx vitest run --coverage", "pnpm exec vitest"])(
    "detects a test script that runs Vitest directly (%s)",
    (test: string): void => {
      expect(scriptRunsVitest({ test })).toBe(true);
    },
  );

  it.each([
    "npm run test:unit",
    "npm run-script test:unit",
    "npm run --silent test:unit",
    "pnpm test:unit",
    "pnpm run test:unit",
    "yarn test:unit",
    "bun run test:unit",
    "tsc --noEmit && npm run test:unit -- --reporter=dot",
    "npm --silent run test:unit",
    'npm run "test:unit"',
    "yarn --silent test:unit",
    "cross-env CI=1 npm run test:unit",
  ])("follows delegation to another script (%s)", (test: string): void => {
    expect(scriptRunsVitest({ test, "test:unit": "vitest run" })).toBe(true);
  });

  it("follows delegation across several scripts", (): void => {
    expect(
      scriptRunsVitest({
        test: "npm run test:all",
        "test:all": "npm run lint && npm run test:unit",
        lint: "eslint .",
        "test:unit": "vitest run",
      }),
    ).toBe(true);
  });

  it("follows npm test from another script", (): void => {
    expect(scriptRunsVitest({ ci: "npm test", test: "vitest run" }, "ci")).toBe(true);
  });

  it("stops on delegation cycles", (): void => {
    expect(
      scriptRunsVitest({ test: "npm run a", a: "npm run b", b: "npm run a" }),
    ).toBe(false);
  });

  it.each([
    ["another runner", { test: "jest" }],
    ["a delegation to another runner", { test: "npm run unit", unit: "jest" }],
    ["a package manager command that is not a script", { test: "npm install" }],
    ["no test script", {}],
  ])(
    "does not detect Vitest for %s",
    (_label: string, scripts: Record<string, string>): void => {
      expect(scriptRunsVitest(scripts)).toBe(false);
    },
  );

  it("does not detect Vitest without scripts", (): void => {
    expect(scriptRunsVitest(undefined)).toBe(false);
  });
});
