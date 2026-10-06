import { describe, expect, it } from "vitest";
import { scriptRunsVitest } from "./scripts.js";

interface ScriptCase {
  readonly label: string;
  readonly scripts: Readonly<Record<string, string>> | null | undefined;
  readonly name?: string;
  readonly expected: boolean;
}

const commandCase = (test: string, expected: boolean, label: string): ScriptCase => ({
  label,
  scripts: { test },
  expected,
});

const chain = (count: number): Record<string, string> =>
  Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `s${String(index)}`,
      index === count - 1 ? "vitest run" : `npm run s${String(index + 1)}`,
    ]),
  );

const diamond = (vitest: boolean): Record<string, string> => ({
  ...Object.fromEntries(
    Array.from({ length: 24 }, (_, index) => [
      `s${String(index)}`,
      `npm run s${String(index + 1)} && npm run s${String(index + 1)}`,
    ]),
  ),
  s24: vitest ? "vitest run" : "eslint .",
});

describe("scriptRunsVitest closed grammar", (): void => {
  const cases: readonly ScriptCase[] = [
    ...["vitest", "vitest run", "vitest watch", "cross-env vitest run"].map(
      (command): ScriptCase => commandCase(command, true, `accepts ${command}`),
    ),
    ...["--run", "--coverage", "--passWithNoTests", "--silent", "--reporter=dot"].map(
      (flag): ScriptCase => commandCase(`vitest ${flag}`, true, `accepts ${flag}`),
    ),
    commandCase(
      "cross-env NODE_ENV=test CI=1 TZ=UTC vitest run",
      true,
      "accepts allowed assignments",
    ),
    {
      label: "accepts allowed punctuation in values and script names",
      scripts: {
        test: "CI=a:._- vitest --reporter=a:._- && npm run a:._-",
        "a:._-": "vitest",
      },
      expected: true,
    },
    ...[
      "vitest --globals",
      "vitest run --config custom.ts",
      "vitest run tests",
      "./bin/vitest run",
      "vitest@3 run",
    ].map((command): ScriptCase => commandCase(command, false, `rejects ${command}`)),
    ...["CI=", "CI=-1", "OTHER=test"].map(
      (assignment): ScriptCase =>
        commandCase(
          `${assignment} vitest run`,
          false,
          `rejects assignment ${assignment}`,
        ),
    ),
    ...["--reporter=", "--reporter=-dot", "--reporter=dot/output"].map(
      (flag): ScriptCase =>
        commandCase(`vitest ${flag}`, false, `rejects reporter ${flag}`),
    ),
    ...["npm", "pnpm", "yarn", "bun"].map(
      (manager): ScriptCase => ({
        label: `accepts ${manager} run delegation`,
        scripts: { test: `${manager} run unit`, unit: "vitest run" },
        expected: true,
      }),
    ),
    ...["npm", "pnpm", "yarn"].map(
      (manager): ScriptCase => ({
        label: `accepts ${manager} test delegation from ci`,
        scripts: { ci: `${manager} test`, test: "vitest run" },
        name: "ci",
        expected: true,
      }),
    ),
    ...["pnpm", "yarn"].map(
      (manager): ScriptCase => ({
        label: `accepts ${manager} colon shorthand`,
        scripts: { test: `${manager} test:unit`, "test:unit": "vitest run" },
        expected: true,
      }),
    ),
    ...["--silent", "-s"].flatMap((flag): ScriptCase[] => [
      {
        label: `accepts ${flag} before run`,
        scripts: { test: `npm ${flag} run unit`, unit: "vitest run" },
        expected: true,
      },
      {
        label: `accepts ${flag} before test`,
        scripts: { ci: `pnpm ${flag} test`, test: "vitest run" },
        name: "ci",
        expected: true,
      },
    ]),
    {
      label: "rejects silent after run",
      scripts: { test: "npm run --silent unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "rejects arguments after delegated script",
      scripts: { test: "npm run unit -- --coverage", unit: "vitest run" },
      expected: false,
    },
    ...["--help", "--", "--workspaces"].map(
      (name): ScriptCase => ({
        label: `rejects option-shaped script ${name}`,
        scripts: { test: `npm run ${name}`, [name]: "vitest run" },
        expected: false,
      }),
    ),
    {
      label: "rejects option-shaped colon shorthand",
      scripts: { test: "pnpm --filter:app", "--filter:app": "vitest run" },
      expected: false,
    },
    commandCase("tsc ~ && vitest run", false, "syntax rejection for tilde"),
    {
      label: "rejects shorthand without colon",
      scripts: { test: "yarn unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "rejects missing own script",
      scripts: { test: "npm run missing" },
      expected: false,
    },
    {
      label: "rejects delegation to another runner",
      scripts: { test: "npm run unit", unit: "jest" },
      expected: false,
    },
    {
      label: "rejects bun test from ci even with a Vitest test script",
      scripts: { ci: "bun test", test: "vitest run" },
      name: "ci",
      expected: false,
    },
    {
      label: "rejects inherited toString",
      scripts: { test: "npm run toString" },
      expected: false,
    },
    {
      label: "rejects inherited string script",
      scripts: Object.assign(
        Object.create({ unit: "vitest run" }) as Record<string, string>,
        { test: "npm run unit" },
      ),
      expected: false,
    },
    {
      label: "rejects non-string delegated value",
      scripts: JSON.parse('{"test":"npm run unit","unit":42}') as Record<
        string,
        string
      >,
      expected: false,
    },
    { label: "rejects absent scripts", scripts: undefined, expected: false },
    {
      label: "rejects null scripts",
      scripts: null,
      expected: false,
    },
    ...["tsc --noEmit", "eslint .", "prettier --check ."].map(
      (preparation): ScriptCase =>
        commandCase(
          `${preparation} && vitest run`,
          true,
          `accepts preparation ${preparation}`,
        ),
    ),
    commandCase("eslint .", false, "preparation alone cannot confirm Vitest"),
    commandCase(
      "tsc-watch --onSuccess=jest && vitest run",
      false,
      "rejects preparation executable outside the exact word boundary",
    ),
    commandCase(
      "false && vitest || jest",
      false,
      "rejects unrecognized false command and alternative syntax",
    ),
    ...["jest && vitest run", "vitest run && node --test"].map(
      (command): ScriptCase =>
        commandCase(command, false, `rejects mixed runners: ${command}`),
    ),
    {
      label: "post hook running Jest vetoes Vitest",
      scripts: { test: "vitest run", posttest: "jest" },
      expected: false,
    },
    {
      label: "preparation hook permits confirmed Vitest",
      scripts: { test: "vitest run", pretest: "eslint ." },
      expected: true,
    },
    {
      label: "ignores inherited string hook",
      scripts: Object.assign(
        Object.create({ pretest: "jest" }) as Record<string, string>,
        { test: "vitest run" },
      ),
      expected: true,
    },
    {
      label: "Vitest in hook alone cannot confirm",
      scripts: { test: "eslint .", pretest: "vitest run" },
      expected: false,
    },
    {
      label: "Vitest in hook of hook cannot confirm",
      scripts: { test: "eslint .", pretest: "eslint .", prepretest: "vitest run" },
      expected: false,
    },
    {
      label: "hooks of hooks do not veto",
      scripts: { test: "vitest run", pretest: "eslint .", prepretest: "jest" },
      expected: true,
    },
    {
      label: "delegated script hook vetoes",
      scripts: { test: "npm run unit", unit: "vitest run", postunit: "jest" },
      expected: false,
    },
    {
      label: "delegation inside hook does not confirm",
      scripts: { test: "eslint .", pretest: "npm run unit", unit: "vitest run" },
      expected: false,
    },
    {
      label: "rejects non-string hook",
      scripts: JSON.parse('{"test":"vitest run","pretest":null}') as Record<
        string,
        string
      >,
      expected: false,
    },
    {
      label: "rejects delegation cycle after Vitest",
      scripts: { test: "vitest run && npm run unit", unit: "npm test" },
      expected: false,
    },
    {
      label: "rejects cycle through hook",
      scripts: { test: "vitest run", pretest: "npm test" },
      expected: false,
    },
    {
      label: "explicit delegation checks cached hook body's own hooks",
      scripts: {
        test: "npm run lint && npm run wrapper && vitest run",
        lint: "eslint .",
        prelint: "eslint .",
        preprelint: "jest",
        wrapper: "npm run prelint",
      },
      expected: false,
    },
    ...[
      { count: 32, expected: true },
      { count: 33, expected: false },
      { count: 3000, expected: false },
    ].map(
      ({ count, expected }): ScriptCase => ({
        label: `${expected ? "accepts" : "rejects"} ${String(count)} unique scripts`,
        scripts: chain(count),
        name: "s0",
        expected,
      }),
    ),
    {
      label: "accepts shared diamond containing Vitest",
      scripts: diamond(true),
      name: "s0",
      expected: true,
    },
    {
      label: "rejects shared diamond without Vitest",
      scripts: diamond(false),
      name: "s0",
      expected: false,
    },
    commandCase(
      `vitest${" ".repeat(4090)}`,
      true,
      "accepts script of exactly 4096 characters",
    ),
    commandCase(
      `vitest${" ".repeat(4091)}`,
      false,
      "rejects script over 4096 characters",
    ),
    commandCase(
      " 	vitest	run	&&	prettier --check .	",
      true,
      "accepts spaces and tabs between words",
    ),
    ...["vitest run &&", "&& vitest run", "vitest run && && eslint ."].map(
      (command): ScriptCase =>
        commandCase(command, false, `rejects empty command: ${command}`),
    ),
  ];

  it.each(cases)("$label", ({ scripts, name, expected }): void => {
    expect(scriptRunsVitest(scripts, name)).toBe(expected);
  });

  it("rejects remaining forbidden shell characters", (): void => {
    const characters = "|;&<>(){}[]$`'\"#\\%^\r\n\u000b\f!*?";
    for (const character of characters) {
      expect(
        scriptRunsVitest({
          test:
            character === "|"
              ? "tsc || jest && vitest run"
              : `tsc ${character} && vitest run`,
        }),
        `syntax rejection for ${JSON.stringify(character)}`,
      ).toBe(false);
    }
  });

  it("rejects unlisted launchers, operations and selectors", (): void => {
    const commands = [
      "npx vitest run",
      "env CI=1 vitest run",
      "dotenv vitest run",
      "pnpm exec vitest",
      "pnpm dlx vitest",
      "bun x vitest",
      "pnpm --filter app run unit",
      "pnpm -w run unit",
      "run-s lint unit",
      "cd app && vitest run",
      "npm_config_workspace=app vitest run",
    ];
    for (const test of commands) {
      expect(
        scriptRunsVitest({ test, unit: "vitest run" }),
        `rejects unlisted form ${test}`,
      ).toBe(false);
    }
  });
});
