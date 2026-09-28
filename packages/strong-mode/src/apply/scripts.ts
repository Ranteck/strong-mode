const PACKAGE_MANAGERS = new Set(["npm", "pnpm", "yarn", "bun"]);
const RUN_SUBCOMMANDS = new Set(["run", "run-script"]);
const EXEC_SUBCOMMANDS = new Set(["exec", "dlx", "x"]);
const COMMAND_WRAPPERS = new Set(["npx", "bunx", "cross-env", "dotenv"]);
const ENV_ASSIGNMENT = /^[A-Za-z_]\w*=/u;

// The commands of a script (split on &&, ||, ; and |), each as its words with
// quotes stripped.
const commandWords = (script: string): string[][] =>
  script
    .split(/&&|\|\||[;|]/u)
    .map((command) =>
      command
        .trim()
        .split(/\s+/u)
        .map((word) => word.replaceAll(/^["']|["']$/gu, ""))
        .filter((word) => word.length > 0),
    )
    .filter((words) => words.length > 0);

// How many leading words only launch the real command: `npx`, `cross-env`,
// `pnpm exec`, `yarn run`, or a bare package manager (`yarn vitest`).
const wrapperLength = (words: readonly string[]): number => {
  const [first, second] = words;
  if (first === undefined) {
    return 0;
  }
  if (COMMAND_WRAPPERS.has(first)) {
    return 1;
  }
  if (!PACKAGE_MANAGERS.has(first)) {
    return 0;
  }
  return second !== undefined &&
    (EXEC_SUBCOMMANDS.has(second) || RUN_SUBCOMMANDS.has(second))
    ? 2
    : 1;
};

// The program a command runs, ignoring flags, env assignments (`NODE_ENV=test`)
// and launchers, so `jest --coverageDirectory=.vitest-coverage` is jest.
const executableOf = (words: readonly string[]): string | undefined => {
  let rest = words.filter(
    (word) => !word.startsWith("-") && !ENV_ASSIGNMENT.test(word),
  );
  for (let skip = wrapperLength(rest); skip > 0; skip = wrapperLength(rest)) {
    rest = rest.slice(skip);
  }
  return rest[0];
};

const runsVitestDirectly = (script: string): boolean =>
  commandWords(script).some(
    (words) => executableOf(words)?.split(/[\\/]/u).at(-1) === "vitest",
  );

// Scripts that a script calls through a package manager: `npm run x`, `npm test`,
// `npm --silent run x`, `pnpm x`, `yarn run "x"`, `cross-env CI=1 bun run x`.
// Flags are dropped wherever they appear, so the first remaining word after the
// package manager (or after `run`) is the script name.
const delegatedScripts = (script: string): string[] =>
  commandWords(script).flatMap((words): string[] => {
    const packageManager = words.findIndex((word) => PACKAGE_MANAGERS.has(word));
    if (packageManager === -1) {
      return [];
    }

    const [first, second] = words
      .slice(packageManager + 1)
      .filter((word) => !word.startsWith("-"));
    const name = first !== undefined && RUN_SUBCOMMANDS.has(first) ? second : first;
    return name === undefined ? [] : [name];
  });

// Whether a package.json script runs Vitest, directly or through the scripts it
// delegates to (`"test": "npm run test:unit"`). Delegation cycles stop the search.
export const scriptRunsVitest = (
  scripts: Readonly<Record<string, string>> | undefined,
  name = "test",
): boolean => {
  const runsVitest = (current: string, visited: ReadonlySet<string>): boolean => {
    const script = scripts?.[current];
    if (script === undefined || visited.has(current)) {
      return false;
    }
    if (runsVitestDirectly(script)) {
      return true;
    }

    const next = new Set([...visited, current]);
    return delegatedScripts(script).some((target) => runsVitest(target, next));
  };

  return runsVitest(name, new Set());
};
