import { describe, expect, it } from "vitest";
import { scriptRunsVitest } from "./scripts.js";

interface ScriptCase {
  readonly label: string;
  readonly scripts: Readonly<Record<string, string>> | undefined;
  readonly name?: string;
  readonly expected: boolean;
}

describe("scriptRunsVitest", (): void => {
  const cases: readonly ScriptCase[] = [
    {
      label: "legacy 1: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "vitest run" },
      expected: true,
    },
    {
      label: "legacy 2: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "npx vitest run --coverage" },
      expected: false,
    },
    {
      label: "legacy 3: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "pnpm exec vitest" },
      expected: false,
    },
    {
      label: "legacy 4: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "yarn vitest" },
      expected: false,
    },
    {
      label: "legacy 5: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "yarn vitest run --coverage" },
      expected: false,
    },
    {
      label: "legacy 6: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "yarn vitest run" },
      expected: false,
    },
    {
      label: "legacy 7: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "yarn run vitest" },
      expected: false,
    },
    {
      label: "legacy 8: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "bun run vitest" },
      expected: false,
    },
    {
      label: "legacy 9: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "NODE_ENV=test vitest" },
      expected: true,
    },
    {
      label: "legacy 10: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "cross-env CI=1 vitest run" },
      expected: true,
    },
    {
      label: "legacy 11: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "dotenv -e .env.test -- vitest run" },
      expected: false,
    },
    {
      label: "legacy 12: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "env TZ=UTC vitest run" },
      expected: false,
    },
    {
      label: "legacy 13: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "pnpm --filter app exec vitest" },
      expected: false,
    },
    {
      label: "legacy 14: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "pnpm --filter app exec npm exec -- vitest" },
      expected: false,
    },
    {
      label: "legacy 15: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "pnpm -r exec env CI=1 vitest" },
      expected: false,
    },
    {
      label: "legacy 16: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "yarn workspace app exec vitest" },
      expected: false,
    },
    {
      label: "legacy 17: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "npx vitest@3 run" },
      expected: false,
    },
    {
      label: "legacy 18: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "./node_modules/.bin/vitest run" },
      expected: false,
    },
    {
      label: "legacy 19: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "NODE_ENV=test node_modules/.bin/vitest" },
      expected: false,
    },
    {
      label: "legacy 20: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "cross-env CI=1 vitest" },
      expected: true,
    },
    {
      label: "legacy 21: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "npm exec -- vitest" },
      expected: false,
    },
    {
      label: "legacy 22: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "bunx vitest run" },
      expected: false,
    },
    {
      label: "legacy 23: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "pnpx vitest run" },
      expected: false,
    },
    {
      label: "legacy 24: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "dotenv vitest run" },
      expected: false,
    },
    {
      label: "legacy 25: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "pnpm dlx vitest run" },
      expected: false,
    },
    {
      label: "legacy 26: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "bun x vitest run" },
      expected: false,
    },
    {
      label: "legacy 27: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "env TZ=UTC npx vitest run" },
      expected: false,
    },
    {
      label: "legacy 28: detects a test script that runs Vitest directly (%s)",
      scripts: { test: '"C:\\tools\\vitest@3" run' },
      expected: false,
    },
    {
      label: "legacy 29: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "tsc --noEmit && vitest run" },
      expected: true,
    },
    {
      label: "legacy 30: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "npx --package jest vitest run" },
      expected: false,
    },
    {
      label: "legacy 31: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "pnpx -p jest vitest run" },
      expected: false,
    },
    {
      label: "legacy 32: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "bunx --package jest vitest run" },
      expected: false,
    },
    {
      label: "legacy 33: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "env -u OTHER -C . vitest run" },
      expected: false,
    },
    {
      label: "legacy 34: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "env --unset OTHER --chdir . vitest run" },
      expected: false,
    },
    {
      label: "legacy 35: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "dotenv -e .env.test -c test -v CI=1 vitest run" },
      expected: false,
    },
    {
      label: "legacy 36: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "npm exec --package jest -- vitest run" },
      expected: false,
    },
    {
      label: "legacy 37: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "npm exec -w app -- vitest" },
      expected: false,
    },
    {
      label: "legacy 38: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "pnpm --dir . --filter app exec vitest" },
      expected: false,
    },
    {
      label: "legacy 39: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "pnpm -C . -F app exec vitest" },
      expected: false,
    },
    {
      label: "legacy 40: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "npm -w app exec vitest" },
      expected: false,
    },
    {
      label: "legacy 41: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "yarn --cwd . vitest" },
      expected: false,
    },
    {
      label: "legacy 42: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "pnpm -w vitest run" },
      expected: false,
    },
    {
      label: "legacy 43: detects a test script that runs Vitest directly (%s)",
      scripts: { test: "pnpm --workspace-root vitest run" },
      expected: false,
    },
    {
      label: "legacy 44: follows delegation to another script (%s)",
      scripts: { test: "npm run test:unit", "test:unit": "vitest run" },
      expected: true,
    },
    {
      label: "legacy 45: follows delegation to another script (%s)",
      scripts: { test: "npm run-script test:unit", "test:unit": "vitest run" },
      expected: false,
    },
    {
      label: "legacy 46: follows delegation to another script (%s)",
      scripts: { test: "npm run --silent test:unit", "test:unit": "vitest run" },
      expected: false,
    },
    {
      label: "legacy 47: follows delegation to another script (%s)",
      scripts: { test: "pnpm test:unit", "test:unit": "vitest run" },
      expected: true,
    },
    {
      label: "legacy 48: follows delegation to another script (%s)",
      scripts: { test: "pnpm run test:unit", "test:unit": "vitest run" },
      expected: true,
    },
    {
      label: "legacy 49: follows delegation to another script (%s)",
      scripts: { test: "yarn test:unit", "test:unit": "vitest run" },
      expected: true,
    },
    {
      label: "legacy 50: follows delegation to another script (%s)",
      scripts: { test: "bun run test:unit", "test:unit": "vitest run" },
      expected: true,
    },
    {
      label: "legacy 51: follows delegation to another script (%s)",
      scripts: {
        test: "tsc --noEmit && npm run test:unit -- --reporter=dot",
        "test:unit": "vitest run",
      },
      expected: false,
    },
    {
      label: "legacy 52: follows delegation to another script (%s)",
      scripts: { test: "npm --silent run test:unit", "test:unit": "vitest run" },
      expected: true,
    },
    {
      label: "legacy 53: follows delegation to another script (%s)",
      scripts: { test: 'npm run "test:unit"', "test:unit": "vitest run" },
      expected: false,
    },
    {
      label: "legacy 54: follows delegation to another script (%s)",
      scripts: { test: "yarn --silent test:unit", "test:unit": "vitest run" },
      expected: false,
    },
    {
      label: "legacy 55: follows delegation to another script (%s)",
      scripts: { test: "cross-env CI=1 npm run test:unit", "test:unit": "vitest run" },
      expected: false,
    },
    {
      label: "legacy 56: follows delegation to another script (%s)",
      scripts: { test: "pnpm -w test:unit", "test:unit": "vitest run" },
      expected: false,
    },
    {
      label: "legacy 57: follows delegation to another script (%s)",
      scripts: { test: "pnpm --workspace-root test:unit", "test:unit": "vitest run" },
      expected: false,
    },
    {
      label: "legacy 58: follows delegation to another script (%s)",
      scripts: { test: "npm --prefix ./ run test:unit", "test:unit": "vitest run" },
      expected: false,
    },
    {
      label: "legacy 59: follows delegation to another script (%s)",
      scripts: { test: "pnpm -C . run test:unit", "test:unit": "vitest run" },
      expected: false,
    },
    {
      label: "legacy 60: follows delegation to another script (%s)",
      scripts: { test: "pnpm --dir ./ run test:unit", "test:unit": "vitest run" },
      expected: false,
    },
    {
      label: "legacy 61: follows delegation to another script (%s)",
      scripts: { test: "yarn --cwd ./ run test:unit", "test:unit": "vitest run" },
      expected: false,
    },
    {
      label: "legacy 62: follows delegation to another script (%s)",
      scripts: { test: "bun --cwd . run test:unit", "test:unit": "vitest run" },
      expected: false,
    },
    {
      label: "legacy 63: follows delegation to another script (%s)",
      scripts: {
        test: "npm run test:unit -- --workspace api",
        "test:unit": "vitest run",
      },
      expected: false,
    },
    {
      label: "legacy 64: follows delegation to another script (%s)",
      scripts: { test: "pnpm run test:unit -- --recursive", "test:unit": "vitest run" },
      expected: false,
    },
    {
      label: "legacy 65: follows delegation to another script (%s)",
      scripts: { test: "bun run test:unit -- --workspaces", "test:unit": "vitest run" },
      expected: false,
    },
    {
      label:
        "legacy 66: follows delegation after a separate package manager option value",
      scripts: { test: "npm --prefix . run x", x: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 67: follows delegation across several scripts",
      scripts: {
        test: "npm run test:all",
        "test:all": "npm run lint && npm run test:unit",
        lint: "eslint .",
        "test:unit": "vitest run",
      },
      expected: true,
    },
    {
      label: "legacy 68: follows npm test from another script",
      scripts: { ci: "npm test", test: "vitest run" },
      name: "ci",
      expected: true,
    },
    {
      label: "legacy 69: follows npm start from the test script",
      scripts: { test: "npm start", start: "vitest" },
      expected: false,
    },
    {
      label: "legacy 70: follows Yarn's script shorthand",
      scripts: { test: "yarn unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 71: follows npm's script-running command %s",
      scripts: { ci: "npm test", test: "vitest run" },
      name: "ci",
      expected: true,
    },
    {
      label: "legacy 72: follows npm's script-running command %s",
      scripts: { ci: "npm t", test: "vitest run" },
      name: "ci",
      expected: false,
    },
    {
      label: "legacy 73: follows npm's script-running command %s",
      scripts: { ci: "npm tst", test: "vitest run" },
      name: "ci",
      expected: false,
    },
    {
      label: "legacy 74: follows npm's script-running command %s",
      scripts: { ci: "npm start", start: "vitest run" },
      name: "ci",
      expected: false,
    },
    {
      label: "legacy 75: follows npm's script-running command %s",
      scripts: { ci: "npm stop", stop: "vitest run" },
      name: "ci",
      expected: false,
    },
    {
      label: "legacy 76: follows npm's script-running command %s",
      scripts: { ci: "npm restart", restart: "vitest run" },
      name: "ci",
      expected: false,
    },
    {
      label: "legacy 77: resolves npm test aliases rather than similarly named scripts",
      scripts: { ci: "npm t", t: "vitest", test: "jest" },
      name: "ci",
      expected: false,
    },
    {
      label: "legacy 78: follows a script named vitest (%s)",
      scripts: { test: "npm run vitest", vitest: "vitest run" },
      expected: true,
    },
    {
      label: "legacy 79: follows a script named vitest (%s)",
      scripts: { test: "npm run vitest", vitest: "jest" },
      expected: false,
    },
    {
      label: "legacy 80: follows a script named vitest (%s)",
      scripts: {
        test: "npm --silent run --silent vitest --silent",
        vitest: "vitest run",
      },
      expected: false,
    },
    {
      label: "legacy 81: follows a script named vitest (%s)",
      scripts: { test: "npm --silent run --silent vitest --silent", vitest: "jest" },
      expected: false,
    },
    {
      label: "legacy 82: follows a script named vitest (%s)",
      scripts: { test: "npm --prefix . run vitest", vitest: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 83: follows a script named vitest (%s)",
      scripts: { test: "npm --prefix . run vitest", vitest: "jest" },
      expected: false,
    },
    {
      label: "legacy 84: follows a script named vitest (%s)",
      scripts: { test: "/usr/bin/npm run vitest", vitest: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 85: follows a script named vitest (%s)",
      scripts: { test: "/usr/bin/npm run vitest", vitest: "jest" },
      expected: false,
    },
    {
      label: "legacy 86: follows a script named vitest (%s)",
      scripts: { test: "pnpm run-script vitest", vitest: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 87: follows a script named vitest (%s)",
      scripts: { test: "pnpm run-script vitest", vitest: "jest" },
      expected: false,
    },
    {
      label: "legacy 88: follows a script named vitest (%s)",
      scripts: { test: "yarn vitest", vitest: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 89: follows a script named vitest (%s)",
      scripts: { test: "yarn vitest", vitest: "jest" },
      expected: false,
    },
    {
      label: "legacy 90: follows a script named vitest (%s)",
      scripts: { test: "bun vitest", vitest: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 91: follows a script named vitest (%s)",
      scripts: { test: "bun vitest", vitest: "jest" },
      expected: false,
    },
    {
      label: "legacy 92: follows a script named vitest (%s)",
      scripts: { test: "yarn run vitest", vitest: "vitest run" },
      expected: true,
    },
    {
      label: "legacy 93: follows a script named vitest (%s)",
      scripts: { test: "yarn run vitest", vitest: "jest" },
      expected: false,
    },
    {
      label: "legacy 94: follows a script named vitest (%s)",
      scripts: { test: "bun run vitest", vitest: "vitest run" },
      expected: true,
    },
    {
      label: "legacy 95: follows a script named vitest (%s)",
      scripts: { test: "bun run vitest", vitest: "jest" },
      expected: false,
    },
    {
      label: "legacy 96: does not treat a missing run script as a program",
      scripts: { test: "npm run vitest" },
      expected: false,
    },
    {
      label: "legacy 97: does not resolve another package's script locally (%s)",
      scripts: { test: "npm --workspace api run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 98: does not resolve another package's script locally (%s)",
      scripts: { test: "npm -w api run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 99: does not resolve another package's script locally (%s)",
      scripts: { test: "npm --workspace=api run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 100: does not resolve another package's script locally (%s)",
      scripts: { test: "npm run --workspace api unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 101: does not resolve another package's script locally (%s)",
      scripts: { test: "npm --prefix api run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 102: does not resolve another package's script locally (%s)",
      scripts: { test: "npm --prefix=api run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 103: does not resolve another package's script locally (%s)",
      scripts: { test: "pnpm --filter app run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 104: does not resolve another package's script locally (%s)",
      scripts: { test: "pnpm -F app unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 105: does not resolve another package's script locally (%s)",
      scripts: { test: "pnpm --filter=app run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 106: does not resolve another package's script locally (%s)",
      scripts: { test: "pnpm run --filter app unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 107: does not resolve another package's script locally (%s)",
      scripts: { test: "pnpm -C app run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 108: does not resolve another package's script locally (%s)",
      scripts: { test: "pnpm --dir=app run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 109: does not resolve another package's script locally (%s)",
      scripts: { test: "yarn workspace app run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 110: does not resolve another package's script locally (%s)",
      scripts: { test: "yarn --cwd app run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 111: does not resolve another package's script locally (%s)",
      scripts: { test: "bun --filter app run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 112: does not resolve another package's script locally (%s)",
      scripts: { test: "bun -F app run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 113: does not resolve another package's script locally (%s)",
      scripts: { test: "bun --cwd=app run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 114: does not resolve another package's script locally (%s)",
      scripts: { test: "npm run unit --workspace api", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 115: does not resolve another package's script locally (%s)",
      scripts: { test: "npm run unit --workspace=api", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 116: does not resolve another package's script locally (%s)",
      scripts: { test: "npm --workspaces run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 117: does not resolve another package's script locally (%s)",
      scripts: { test: "npm run unit -ws", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 118: does not resolve another package's script locally (%s)",
      scripts: { test: "npm run unit --ws", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 119: does not resolve another package's script locally (%s)",
      scripts: { test: "pnpm -r run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 120: does not resolve another package's script locally (%s)",
      scripts: { test: "pnpm --recursive run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 121: does not resolve another package's script locally (%s)",
      scripts: { test: "pnpm run unit --filter api", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 122: does not resolve another package's script locally (%s)",
      scripts: { test: "yarn workspaces run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 123: does not resolve another package's script locally (%s)",
      scripts: { test: "yarn workspaces foreach run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 124: does not resolve another package's script locally (%s)",
      scripts: { test: "bun --workspaces run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 125: does not resolve another package's script locally (%s)",
      scripts: { test: "bun run unit --workspaces", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 126: does not resolve another package's script locally (%s)",
      scripts: { test: "pnpm --filter api exec npm run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 127: does not resolve another package's script locally (%s)",
      scripts: { test: "pnpm --filter api exec -- npm run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 128: does not resolve another package's script locally (%s)",
      scripts: { test: "npm exec -w api -- yarn unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 129: does not resolve another package's script locally (%s)",
      scripts: { test: "pnpm -r exec cross-env CI=1 npm run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 130: does not resolve another package's script locally (%s)",
      scripts: {
        test: "pnpm --filter api exec yarn --cwd . run unit",
        unit: "vitest run",
      },
      expected: false,
    },
    {
      label:
        "legacy 131: does not resolve another package's vitest script locally (%s)",
      scripts: { test: "npm --workspace app run vitest", vitest: "vitest run" },
      expected: false,
    },
    {
      label:
        "legacy 132: does not resolve another package's vitest script locally (%s)",
      scripts: { test: "npm --workspace app run vitest", vitest: "jest" },
      expected: false,
    },
    {
      label:
        "legacy 133: does not resolve another package's vitest script locally (%s)",
      scripts: { test: "yarn workspace app run vitest", vitest: "vitest run" },
      expected: false,
    },
    {
      label:
        "legacy 134: does not resolve another package's vitest script locally (%s)",
      scripts: { test: "yarn workspace app run vitest", vitest: "jest" },
      expected: false,
    },
    {
      label:
        "legacy 135: does not resolve another package's vitest script locally (%s)",
      scripts: { test: "bun --filter app run vitest", vitest: "vitest run" },
      expected: false,
    },
    {
      label:
        "legacy 136: does not resolve another package's vitest script locally (%s)",
      scripts: { test: "bun --filter app run vitest", vitest: "jest" },
      expected: false,
    },
    {
      label: "legacy 137: stops on delegation cycles",
      scripts: { test: "npm run a", a: "npm run b", b: "npm run a" },
      expected: false,
    },
    {
      label:
        "legacy 138: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "npm ci", ci: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 139: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "npm unit", unit: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 140: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm install", install: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 141: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm i", i: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 142: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm add", add: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 143: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm update", update: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 144: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm access", access: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 145: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm shim", shim: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 146: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm pm", pm: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 147: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm prefix", prefix: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 148: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm info", info: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 149: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm show", show: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 150: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm v", v: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 151: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm stars", stars: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 152: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm unstar", unstar: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 153: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm edit", edit: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 154: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm issues", issues: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 155: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm profile", profile: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 156: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm token", token: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 157: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "pnpm xmas", xmas: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 158: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "yarn check --integrity", check: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 159: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "yarn install", install: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 160: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "yarn constraints", constraints: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 161: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "yarn npm info vitest", npm: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 162: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "bun test", test: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 163: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "bun build", build: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 164: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "bun install", install: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 165: does not resolve a built-in or unsupported command as a script (%s)",
      scripts: { wrapper: "bun rm", rm: "vitest run" },
      name: "wrapper",
      expected: false,
    },
    {
      label:
        "legacy 166: allows explicit run to select a script with a built-in name (%s)",
      scripts: { test: "pnpm run install", install: "vitest run" },
      expected: true,
    },
    {
      label:
        "legacy 167: allows explicit run to select a script with a built-in name (%s)",
      scripts: { test: "yarn run install", install: "vitest run" },
      expected: true,
    },
    {
      label:
        "legacy 168: allows explicit run to select a script with a built-in name (%s)",
      scripts: { test: "bun run install", install: "vitest run" },
      expected: true,
    },
    {
      label: "legacy 169: does not detect Vitest for %s",
      scripts: { test: "jest" },
      expected: false,
    },
    {
      label: "legacy 170: does not detect Vitest for %s",
      scripts: { test: "dotenv jest -- vitest" },
      expected: false,
    },
    {
      label: "legacy 171: does not detect Vitest for %s",
      scripts: { test: "dotenv CI=1 vitest" },
      expected: false,
    },
    {
      label: "legacy 172: does not detect Vitest for %s",
      scripts: { test: "yarn jest run vitest", vitest: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 173: does not detect Vitest for %s",
      scripts: { test: "npx --package vitest jest" },
      expected: false,
    },
    {
      label: "legacy 174: does not detect Vitest for %s",
      scripts: { test: "pnpx -p vitest jest" },
      expected: false,
    },
    {
      label: "legacy 175: does not detect Vitest for %s",
      scripts: { test: "bunx --package vitest jest" },
      expected: false,
    },
    {
      label: "legacy 176: does not detect Vitest for %s",
      scripts: { test: "npm exec --package vitest -- jest" },
      expected: false,
    },
    {
      label: "legacy 177: does not detect Vitest for %s",
      scripts: { test: "npm exec --workspace vitest -- jest" },
      expected: false,
    },
    {
      label: "legacy 178: does not detect Vitest for %s",
      scripts: { test: "env -u vitest node --test" },
      expected: false,
    },
    {
      label: "legacy 179: does not detect Vitest for %s",
      scripts: { test: "env --chdir vitest node --test" },
      expected: false,
    },
    {
      label: "legacy 180: does not detect Vitest for %s",
      scripts: { test: "dotenv -e vitest jest" },
      expected: false,
    },
    {
      label: "legacy 181: does not detect Vitest for %s",
      scripts: { test: "dotenv -c vitest jest" },
      expected: false,
    },
    {
      label: "legacy 182: does not detect Vitest for %s",
      scripts: { test: "dotenv -v vitest jest" },
      expected: false,
    },
    {
      label: "legacy 183: does not detect Vitest for %s",
      scripts: { test: "npx --package=vitest jest" },
      expected: false,
    },
    {
      label: "legacy 184: does not detect Vitest for %s",
      scripts: { test: 'npx -c "vitest run"' },
      expected: false,
    },
    {
      label: "legacy 185: does not detect Vitest for %s",
      scripts: { test: 'pnpx --call "vitest run"' },
      expected: false,
    },
    {
      label: "legacy 186: does not detect Vitest for %s",
      scripts: { test: 'bunx -c "vitest run"' },
      expected: false,
    },
    {
      label: "legacy 187: does not detect Vitest for %s",
      scripts: { test: 'npm exec --call "vitest run"' },
      expected: false,
    },
    {
      label: "legacy 188: does not detect Vitest for %s",
      scripts: { test: 'npx --call="vitest run"' },
      expected: false,
    },
    {
      label: "legacy 189: does not detect Vitest for %s",
      scripts: { test: 'env -S "vitest run"' },
      expected: false,
    },
    {
      label: "legacy 190: does not detect Vitest for %s",
      scripts: { test: 'env --split-string "vitest run"' },
      expected: false,
    },
    {
      label: "legacy 191: does not detect Vitest for %s",
      scripts: { test: "npx --package vitest" },
      expected: false,
    },
    {
      label: "legacy 192: does not detect Vitest for %s",
      scripts: { test: "yarn --cwd vitest" },
      expected: false,
    },
    {
      label: "legacy 193: does not detect Vitest for %s",
      scripts: { test: "jest vitest" },
      expected: false,
    },
    {
      label: "legacy 194: does not detect Vitest for %s",
      scripts: { test: "jest --config vitest" },
      expected: false,
    },
    {
      label: "legacy 195: does not detect Vitest for %s",
      scripts: { test: "tsc -p vitest" },
      expected: false,
    },
    {
      label: "legacy 196: does not detect Vitest for %s",
      scripts: { test: "echo vitest" },
      expected: false,
    },
    {
      label: "legacy 197: does not detect Vitest for %s",
      scripts: { test: "node scripts/vitest" },
      expected: false,
    },
    {
      label: "legacy 198: does not detect Vitest for %s",
      scripts: { test: "echo npm run vitest", vitest: "vitest run" },
      expected: false,
    },
    {
      label: "legacy 199: does not detect Vitest for %s",
      scripts: { test: "jest --coverageDirectory=.vitest-coverage" },
      expected: false,
    },
    {
      label: "legacy 200: does not detect Vitest for %s",
      scripts: { test: "node --test tests/vitest/*.test.ts" },
      expected: false,
    },
    {
      label: "legacy 201: does not detect Vitest for %s",
      scripts: { test: "npm run unit", unit: "jest" },
      expected: false,
    },
    {
      label: "legacy 202: does not detect Vitest for %s",
      scripts: { test: "npm install" },
      expected: false,
    },
    {
      label: "legacy 203: does not detect Vitest for %s",
      scripts: {},
      expected: false,
    },
    {
      label: "legacy 204: does not detect Vitest without scripts",
      scripts: undefined,
      expected: false,
    },
    {
      label: "mixed runners",
      scripts: { test: "jest && vitest run" },
      expected: false,
    },
    {
      label: "non-Vitest post hook",
      scripts: { test: "vitest run", posttest: "jest" },
      expected: false,
    },
    {
      label: "shell fallback",
      scripts: { test: "false && vitest || jest" },
      expected: false,
    },
    {
      label: "inherited toString",
      scripts: { test: "npm run toString" },
      expected: false,
    },
    {
      label: "inherited constructor shorthand",
      scripts: { test: "yarn constructor" },
      expected: false,
    },
    {
      label: "preparation then Vitest",
      scripts: { test: "tsc --noEmit && vitest run" },
      expected: true,
    },
    {
      label: "pnpm namespaced shorthand",
      scripts: { test: "pnpm test:unit", "test:unit": "vitest run" },
      expected: true,
    },
    {
      label: "pnpm test from ci",
      scripts: { ci: "pnpm test", test: "vitest run" },
      name: "ci",
      expected: true,
    },
    {
      label: "cross-env NODE_ENV",
      scripts: { test: "cross-env NODE_ENV=test vitest run" },
      expected: true,
    },
    {
      label: "preparation pre hook",
      scripts: { test: "vitest run", pretest: "eslint ." },
      expected: true,
    },
    {
      label: "non-Vitest pre hook",
      scripts: { test: "vitest run", pretest: "node --test" },
      expected: false,
    },
    {
      label: "delegated non-Vitest hook",
      scripts: {
        test: "npm run test:unit",
        "test:unit": "vitest run",
        "posttest:unit": "jest",
      },
      expected: false,
    },
    {
      label: "hook delegation cycle",
      scripts: { test: "vitest run", pretest: "npm test" },
      expected: false,
    },
    {
      label: "Vitest in hook",
      scripts: { test: "tsc --noEmit", posttest: "vitest run" },
      expected: true,
    },
    {
      label: "preparation only",
      scripts: { test: "eslint . && prettier --check ." },
      expected: false,
    },
    {
      label: "all Vitest flags",
      scripts: {
        test: "cross-env NODE_ENV=test CI=1 TZ=UTC vitest watch --run --coverage --passWithNoTests --silent --reporter=dot",
      },
      expected: true,
    },
    {
      label: "spaces and tabs",
      scripts: { test: " \tvitest\trun\t&&\tprettier --check .\t " },
      expected: true,
    },
    {
      label: "unsupported assignment",
      scripts: { test: "npm_config_workspace=app vitest run" },
      expected: false,
    },
    {
      label: "cross-env delegation",
      scripts: { test: "cross-env npm test", ci: "vitest run" },
      expected: false,
    },
    {
      label: "unsupported flag",
      scripts: { test: "vitest run --config custom.ts" },
      expected: false,
    },
    {
      label: "positional path",
      scripts: { test: "vitest run tests" },
      expected: false,
    },
    {
      label: "empty reporter",
      scripts: { test: "vitest --reporter=" },
      expected: false,
    },
    {
      label: "versioned executable",
      scripts: { test: "vitest@3 run" },
      expected: false,
    },
    {
      label: "cd before Vitest",
      scripts: { test: "cd subdir && vitest run" },
      expected: false,
    },
    { label: "missing script body", scripts: { test: "" }, expected: false },
    { label: "empty command", scripts: { test: "vitest run &&" }, expected: false },
    { label: "leading separator", scripts: { test: "&& vitest run" }, expected: false },
    {
      label: "repeated separator",
      scripts: { test: "vitest run && && eslint ." },
      expected: false,
    },
    ...["npm", "pnpm", "yarn", "bun"].flatMap((manager): ScriptCase[] => [
      {
        label: "explicit run",
        scripts: { test: `${manager} run test:unit`, "test:unit": "vitest run" },
        expected: true,
      },
      {
        label: "silent before run",
        scripts: {
          test: `${manager} --silent run test:unit`,
          "test:unit": "vitest run",
        },
        expected: true,
      },
      {
        label: "short silent before run",
        scripts: { test: `${manager} -s run test:unit`, "test:unit": "vitest run" },
        expected: true,
      },
    ]),
    ...["npm", "pnpm", "yarn"].flatMap((manager): ScriptCase[] => [
      {
        label: "test shorthand",
        scripts: { ci: `${manager} test`, test: "vitest run" },
        name: "ci",
        expected: true,
      },
      {
        label: "silent before test",
        scripts: { ci: `${manager} --silent test`, test: "vitest run" },
        name: "ci",
        expected: true,
      },
      {
        label: "short silent before test",
        scripts: { ci: `${manager} -s test`, test: "vitest run" },
        name: "ci",
        expected: true,
      },
    ]),
    ...[
      "|",
      ";",
      "&",
      "<",
      ">",
      "(",
      ")",
      "{",
      "}",
      "$",
      "`",
      "'",
      '"',
      "#",
      "\n",
      "!",
      "*",
      "?",
    ].map(
      (character): ScriptCase => ({
        label: "unsupported shell character",
        scripts: { test: `tsc ${character} && vitest run` },
        expected: false,
      }),
    ),
  ];

  it.each(cases)(
    "$label: $scripts ($name) => $expected",
    ({ scripts, name, expected }): void => {
      expect(scriptRunsVitest(scripts, name)).toBe(expected);
    },
  );
  it("rejects a 3000-script chain without throwing", (): void => {
    const scripts: Record<string, string> = { test: "npm run s0" };
    for (let index = 0; index < 3000; index += 1) {
      scripts[`s${String(index)}`] =
        index === 2999 ? "vitest run" : `npm run s${String(index + 1)}`;
    }
    expect(scriptRunsVitest(scripts)).toBe(false);
  });

  it.each([32, 33])(
    "permits at most 32 visited scripts (%i)",
    (count: number): void => {
      const scripts: Record<string, string> = {};
      for (let index = 0; index < count; index += 1) {
        scripts[`s${String(index)}`] =
          index === count - 1 ? "vitest run" : `npm run s${String(index + 1)}`;
      }
      expect(scriptRunsVitest(scripts, "s0")).toBe(count === 32);
    },
  );

  it.each([false, true])(
    "evaluates a 24-level shared diamond quickly (Vitest: %s)",
    (vitest: boolean): void => {
      const scripts: Record<string, string> = {
        s24: vitest ? "vitest run" : "eslint .",
      };
      for (let index = 0; index < 24; index += 1) {
        scripts[`s${String(index)}`] =
          `npm run s${String(index + 1)} && npm run s${String(index + 1)}`;
      }
      expect(scriptRunsVitest(scripts, "s0")).toBe(vitest);
    },
    1000,
  );

  it.each([
    '{"test":42}',
    '{"test":"npm run unit","unit":null}',
    '{"test":"vitest run","pretest":false}',
    '{"test":"vitest run","posttest":[]}',
  ])("rejects non-string script values without throwing (%s)", (json: string): void => {
    const scripts = JSON.parse(json) as Record<string, string>;
    expect(scriptRunsVitest(scripts)).toBe(false);
  });

  it("ignores inherited scripts and hooks", (): void => {
    class Scripts {
      test = "vitest run";
      pretest(): string {
        return "jest";
      }
      unit(): string {
        return "vitest run";
      }
    }
    const scripts = Object.assign(
      Object.create(Scripts.prototype) as Record<string, string>,
      { test: "vitest run" },
    );
    expect(scriptRunsVitest({ ...scripts })).toBe(true);
    expect(scriptRunsVitest(scripts as Record<string, string>)).toBe(true);
    expect(scriptRunsVitest(scripts as Record<string, string>, "unit")).toBe(false);
  });
});
