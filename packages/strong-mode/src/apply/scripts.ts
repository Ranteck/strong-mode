const RUNS_VITEST = /\bvitest\b/u;
const PACKAGE_MANAGERS = new Set(["npm", "pnpm", "yarn", "bun"]);
const RUN_SUBCOMMANDS = new Set(["run", "run-script"]);

// Scripts that a script calls through a package manager: `npm run x`, `npm test`,
// `npm --silent run x`, `pnpm x`, `yarn run "x"`, `cross-env CI=1 bun run x`.
// Flags are dropped wherever they appear, so the first remaining word after the
// package manager (or after `run`) is the script name.
const delegatedScripts = (script: string): string[] =>
  script.split(/&&|\|\||[;|]/u).flatMap((command): string[] => {
    const words = command
      .trim()
      .split(/\s+/u)
      .map((word) => word.replaceAll(/^["']|["']$/gu, ""));
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
    if (RUNS_VITEST.test(script)) {
      return true;
    }

    const next = new Set([...visited, current]);
    return delegatedScripts(script).some((target) => runsVitest(target, next));
  };

  return runsVitest(name, new Set());
};
