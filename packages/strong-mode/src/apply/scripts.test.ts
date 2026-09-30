import { describe, expect, it } from "vitest";
import { scriptRunsVitest } from "./scripts.js";

describe("scriptRunsVitest", (): void => {
  it.each([
    "vitest run",
    "npx vitest run --coverage",
    "pnpm exec vitest",
    "yarn vitest",
    "NODE_ENV=test vitest",
    "cross-env CI=1 vitest run",
    "dotenv -e .env.test -- vitest run",
    "env TZ=UTC vitest run",
    "pnpm --filter app exec vitest",
    "npx vitest@3 run",
    "./node_modules/.bin/vitest run",
    "NODE_ENV=test node_modules/.bin/vitest",
    "cross-env CI=1 vitest",
    "npm exec -- vitest",
    "bunx vitest run",
    "pnpx vitest run",
    "dotenv vitest run",
    "pnpm dlx vitest run",
    "bun x vitest run",
    "env TZ=UTC npx vitest run",
    '"C:\\tools\\vitest@3" run',
    "tsc --noEmit && vitest run",
  ])("detects a test script that runs Vitest directly (%s)", (test: string): void => {
    expect(scriptRunsVitest({ test })).toBe(true);
  });

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

  it("follows delegation after a separate package manager option value", (): void => {
    expect(scriptRunsVitest({ test: "npm --prefix . run x", x: "vitest run" })).toBe(
      true,
    );
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

  it.each([
    "npm run vitest",
    "npm --silent run --silent vitest --silent",
    "npm --prefix . run vitest",
    "/usr/bin/npm run vitest",
    "yarn workspace app run vitest",
    "pnpm run-script vitest",
    "yarn vitest",
    "bun vitest",
  ])("follows a script named vitest (%s)", (test: string): void => {
    expect(scriptRunsVitest({ test, vitest: "vitest run" })).toBe(true);
    expect(scriptRunsVitest({ test, vitest: "jest" })).toBe(false);
  });

  it("does not treat a missing run script as a program", (): void => {
    expect(scriptRunsVitest({ test: "npm run vitest" })).toBe(false);
  });

  it("stops on delegation cycles", (): void => {
    expect(
      scriptRunsVitest({ test: "npm run a", a: "npm run b", b: "npm run a" }),
    ).toBe(false);
  });

  it.each([
    ["another runner", { test: "jest" }],
    ["another runner with a vitest argument", { test: "jest vitest" }],
    ["another runner with a vitest option value", { test: "jest --config vitest" }],
    ["a compiler with a vitest project argument", { test: "tsc -p vitest" }],
    ["an echoed vitest argument", { test: "echo vitest" }],
    ["a node script named vitest", { test: "node scripts/vitest" }],
    [
      "a package manager argument",
      { test: "echo npm run vitest", vitest: "vitest run" },
    ],
    [
      "another runner whose options mention vitest",
      { test: "jest --coverageDirectory=.vitest-coverage" },
    ],
    [
      "another runner given a vitest path",
      { test: "node --test tests/vitest/*.test.ts" },
    ],
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
