import { describe, expect, it } from "vitest";
import { scriptRunsVitest } from "./scripts.js";

describe("scriptRunsVitest", (): void => {
  it.each([
    "vitest run",
    "npx vitest run --coverage",
    "pnpm exec vitest",
    "yarn vitest",
    "yarn vitest run --coverage",
    "yarn vitest run",
    "yarn run vitest",
    "bun run vitest",
    "NODE_ENV=test vitest",
    "cross-env CI=1 vitest run",
    "dotenv -e .env.test -- vitest run",
    "env TZ=UTC vitest run",
    "pnpm --filter app exec vitest",
    "pnpm --filter app exec npm exec -- vitest",
    "pnpm -r exec env CI=1 vitest",
    "yarn workspace app exec vitest",
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
    "npx --package jest vitest run",
    "pnpx -p jest vitest run",
    "bunx --package jest vitest run",
    "env -u OTHER -C . vitest run",
    "env --unset OTHER --chdir . vitest run",
    "dotenv -e .env.test -c test -v CI=1 vitest run",
    "npm exec --package jest -- vitest run",
    "npm exec -w app -- vitest",
    "pnpm --dir . --filter app exec vitest",
    "pnpm -C . -F app exec vitest",
    "npm -w app exec vitest",
    "yarn --cwd . vitest",
    "pnpm -w vitest run",
    "pnpm --workspace-root vitest run",
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
    "pnpm -w test:unit",
    "pnpm --workspace-root test:unit",
    "npm --prefix ./ run test:unit",
    "pnpm -C . run test:unit",
    "pnpm --dir ./ run test:unit",
    "yarn --cwd ./ run test:unit",
    "bun --cwd . run test:unit",
    "npm run test:unit -- --workspace api",
    "pnpm run test:unit -- --recursive",
    "bun run test:unit -- --workspaces",
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

  it("follows npm start from the test script", (): void => {
    expect(scriptRunsVitest({ test: "npm start", start: "vitest" })).toBe(true);
  });

  it("follows Yarn's script shorthand", (): void => {
    expect(scriptRunsVitest({ test: "yarn unit", unit: "vitest run" })).toBe(true);
  });

  it.each(["test", "t", "tst", "start", "stop", "restart"])(
    "follows npm's script-running command %s",
    (command: string): void => {
      const name = command === "t" || command === "tst" ? "test" : command;
      expect(
        scriptRunsVitest({ ci: `npm ${command}`, [name]: "vitest run" }, "ci"),
      ).toBe(true);
    },
  );

  it("resolves npm test aliases rather than similarly named scripts", (): void => {
    expect(scriptRunsVitest({ ci: "npm t", t: "vitest", test: "jest" }, "ci")).toBe(
      false,
    );
  });

  it.each([
    "npm run vitest",
    "npm --silent run --silent vitest --silent",
    "npm --prefix . run vitest",
    "/usr/bin/npm run vitest",
    "pnpm run-script vitest",
    "yarn vitest",
    "bun vitest",
    "yarn run vitest",
    "bun run vitest",
  ])("follows a script named vitest (%s)", (test: string): void => {
    expect(scriptRunsVitest({ test, vitest: "vitest run" })).toBe(true);
    expect(scriptRunsVitest({ test, vitest: "jest" })).toBe(false);
  });

  it("does not treat a missing run script as a program", (): void => {
    expect(scriptRunsVitest({ test: "npm run vitest" })).toBe(false);
  });

  it.each([
    "npm --workspace api run unit",
    "npm -w api run unit",
    "npm --workspace=api run unit",
    "npm run --workspace api unit",
    "npm --prefix api run unit",
    "npm --prefix=api run unit",
    "pnpm --filter app run unit",
    "pnpm -F app unit",
    "pnpm --filter=app run unit",
    "pnpm run --filter app unit",
    "pnpm -C app run unit",
    "pnpm --dir=app run unit",
    "yarn workspace app run unit",
    "yarn --cwd app run unit",
    "bun --filter app run unit",
    "bun -F app run unit",
    "bun --cwd=app run unit",
    "npm run unit --workspace api",
    "npm run unit --workspace=api",
    "npm --workspaces run unit",
    "npm run unit -ws",
    "npm run unit --ws",
    "pnpm -r run unit",
    "pnpm --recursive run unit",
    "pnpm run unit --filter api",
    "yarn workspaces run unit",
    "yarn workspaces foreach run unit",
    "bun --workspaces run unit",
    "bun run unit --workspaces",
    "pnpm --filter api exec npm run unit",
    "pnpm --filter api exec -- npm run unit",
    "npm exec -w api -- yarn unit",
    "pnpm -r exec cross-env CI=1 npm run unit",
    "pnpm --filter api exec yarn --cwd . run unit",
  ])("does not resolve another package's script locally (%s)", (test: string): void => {
    expect(scriptRunsVitest({ test, unit: "vitest run" })).toBe(false);
  });

  it.each([
    "npm --workspace app run vitest",
    "yarn workspace app run vitest",
    "bun --filter app run vitest",
  ])(
    "does not resolve another package's vitest script locally (%s)",
    (test: string): void => {
      expect(scriptRunsVitest({ test, vitest: "vitest run" })).toBe(false);
      expect(scriptRunsVitest({ test, vitest: "jest" })).toBe(false);
    },
  );

  it("stops on delegation cycles", (): void => {
    expect(
      scriptRunsVitest({ test: "npm run a", a: "npm run b", b: "npm run a" }),
    ).toBe(false);
  });

  it.each([
    ["npm ci", "ci"],
    ["npm unit", "unit"],
    ["pnpm install", "install"],
    ["pnpm i", "i"],
    ["pnpm add", "add"],
    ["pnpm update", "update"],
    ["pnpm access", "access"],
    ["pnpm shim", "shim"],
    ["pnpm pm", "pm"],
    ["pnpm prefix", "prefix"],
    ["pnpm info", "info"],
    ["pnpm show", "show"],
    ["pnpm v", "v"],
    ["pnpm stars", "stars"],
    ["pnpm unstar", "unstar"],
    ["pnpm edit", "edit"],
    ["pnpm issues", "issues"],
    ["pnpm profile", "profile"],
    ["pnpm token", "token"],
    ["pnpm xmas", "xmas"],
    ["yarn check --integrity", "check"],
    ["yarn install", "install"],
    ["yarn constraints", "constraints"],
    ["yarn npm info vitest", "npm"],
    ["bun test", "test"],
    ["bun build", "build"],
    ["bun install", "install"],
    ["bun rm", "rm"],
  ])(
    "does not resolve a built-in or unsupported command as a script (%s)",
    (command: string, name: string): void => {
      expect(
        scriptRunsVitest({ wrapper: command, [name]: "vitest run" }, "wrapper"),
      ).toBe(false);
    },
  );

  it.each(["pnpm", "yarn", "bun"])(
    "allows explicit run to select a script with a built-in name (%s)",
    (manager: string): void => {
      expect(
        scriptRunsVitest({ test: `${manager} run install`, install: "vitest run" }),
      ).toBe(true);
    },
  );

  it.each([
    ["another runner", { test: "jest" }],
    ["a dotenv separator after the program", { test: "dotenv jest -- vitest" }],
    ["a dotenv positional assignment", { test: "dotenv CI=1 vitest" }],
    [
      "a runner argument that resembles delegation",
      { test: "yarn jest run vitest", vitest: "vitest run" },
    ],
    ["an npx package option", { test: "npx --package vitest jest" }],
    ["a pnpx package option", { test: "pnpx -p vitest jest" }],
    ["a bunx package option", { test: "bunx --package vitest jest" }],
    ["an npm exec package option", { test: "npm exec --package vitest -- jest" }],
    ["an npm exec workspace option", { test: "npm exec --workspace vitest -- jest" }],
    ["an unset environment variable", { test: "env -u vitest node --test" }],
    ["an env working directory", { test: "env --chdir vitest node --test" }],
    ["a dotenv option value", { test: "dotenv -e vitest jest" }],
    ["a dotenv context value", { test: "dotenv -c vitest jest" }],
    ["a dotenv variable value", { test: "dotenv -v vitest jest" }],
    ["an inline npx package option", { test: "npx --package=vitest jest" }],
    ["an ambiguous npx command string", { test: 'npx -c "vitest run"' }],
    ["an ambiguous pnpx command string", { test: 'pnpx --call "vitest run"' }],
    ["an ambiguous bunx command string", { test: 'bunx -c "vitest run"' }],
    ["an ambiguous npm exec command string", { test: 'npm exec --call "vitest run"' }],
    ["an inline command string", { test: 'npx --call="vitest run"' }],
    ["an ambiguous env command string", { test: 'env -S "vitest run"' }],
    ["an ambiguous env split string", { test: 'env --split-string "vitest run"' }],
    ["a launcher without a program", { test: "npx --package vitest" }],
    ["a package manager without a program", { test: "yarn --cwd vitest" }],
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
