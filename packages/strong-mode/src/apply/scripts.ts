const PACKAGE_MANAGERS = new Set(["npm", "pnpm", "yarn", "bun"]);
const RUN_SUBCOMMANDS = new Set(["run", "run-script"]);
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

const delegatedScriptIndex = (words: readonly string[]): number => {
  const packageManager = words.findIndex((word) => PACKAGE_MANAGERS.has(word));
  if (packageManager === -1) {
    return -1;
  }
  return (
    packageManager + (RUN_SUBCOMMANDS.has(words[packageManager + 1] ?? "") ? 2 : 1)
  );
};

const runsVitestDirectly = (
  script: string,
  scripts: Readonly<Record<string, string>> | undefined,
): boolean =>
  commandWords(script).some((command) => {
    const words = command.filter(
      (word) => !word.startsWith("-") && !ENV_ASSIGNMENT.test(word),
    );
    const delegatedIndex = delegatedScriptIndex(words);
    const name = words[delegatedIndex];
    const launcher = words[delegatedIndex - 1];
    // A delegated name is resolved through scripts, even when it is `vitest`.
    const isScriptName =
      name !== undefined &&
      launcher !== undefined &&
      (RUN_SUBCOMMANDS.has(launcher) ||
        (launcher !== "npm" && scripts?.[name] !== undefined));

    return words.some(
      (word, index) =>
        !(isScriptName && index === delegatedIndex) &&
        word.split(/[\\/]/u).at(-1)?.split("@")[0] === "vitest",
    );
  });

// Scripts that a script calls through a package manager: `npm run x`, `npm test`,
// `npm --silent run x`, `pnpm x`, `yarn run "x"`, `cross-env CI=1 bun run x`.
// Flags are dropped wherever they appear, so the first remaining word after the
// package manager (or after `run`) is the script name.
const delegatedScripts = (script: string): string[] =>
  commandWords(script).flatMap((command): string[] => {
    const words = command.filter((word) => !word.startsWith("-"));
    const name = words[delegatedScriptIndex(words)];
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
    if (runsVitestDirectly(script, scripts)) {
      return true;
    }

    const next = new Set([...visited, current]);
    return delegatedScripts(script).some((target) => runsVitest(target, next));
  };

  return runsVitest(name, new Set());
};
