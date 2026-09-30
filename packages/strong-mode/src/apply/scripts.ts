const PACKAGE_MANAGERS = new Set(["npm", "pnpm", "yarn", "bun"]);
const RUN_SUBCOMMANDS = new Set(["run", "run-script"]);
const EXEC_SUBCOMMANDS = new Set(["exec", "dlx", "x"]);
const LAUNCHERS = new Set(["npx", "bunx", "pnpx", "cross-env", "env", "dotenv"]);
const ENV_ASSIGNMENT = /^[A-Za-z_]\w*=/u;

interface CommandTarget {
  kind: "program" | "script";
  name: string;
}

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

const programName = (word: string): string =>
  word.split(/[\\/]/u).at(-1)?.split("@")[0] ?? "";

const launchedWords = (
  program: string,
  words: readonly string[],
): readonly string[] => {
  const separator = program === "dotenv" ? words.indexOf("--") : -1;
  if (separator !== -1) {
    return words.slice(separator + 1);
  }
  const index = words.findIndex(
    (word): boolean =>
      !word.startsWith("-") && (program === "dotenv" || !ENV_ASSIGNMENT.test(word)),
  );
  return index === -1 ? [] : words.slice(index);
};

const packageManagerTarget = (
  packageManager: string,
  words: readonly string[],
  scripts: Readonly<Record<string, string>> | undefined,
): CommandTarget | undefined => {
  // Find the subcommand before interpreting positional words: preceding option
  // values and workspace names are not the delegated script or executable.
  const subcommandIndex = words.findIndex(
    (word): boolean => RUN_SUBCOMMANDS.has(word) || EXEC_SUBCOMMANDS.has(word),
  );
  const subcommand = words[subcommandIndex] ?? "";
  const argumentsWords = words.slice(subcommandIndex + 1);
  const targetIndex = argumentsWords.findIndex(
    (word): boolean => !word.startsWith("-"),
  );
  const name = argumentsWords[targetIndex];
  if (name === undefined) {
    return undefined;
  }
  if (EXEC_SUBCOMMANDS.has(subcommand)) {
    return resolveCommand(argumentsWords.slice(targetIndex), scripts);
  }
  if (
    RUN_SUBCOMMANDS.has(subcommand) ||
    packageManager === "npm" ||
    scripts?.[name] !== undefined
  ) {
    return { kind: "script", name };
  }
  return resolveCommand(argumentsWords.slice(targetIndex), scripts);
};

const resolveCommand = (
  words: readonly string[],
  scripts: Readonly<Record<string, string>> | undefined,
): CommandTarget | undefined => {
  const index = words.findIndex((word): boolean => !ENV_ASSIGNMENT.test(word));
  const word = words[index];
  if (word === undefined) {
    return undefined;
  }
  const program = programName(word);
  const argumentsWords = words.slice(index + 1);
  if (PACKAGE_MANAGERS.has(program)) {
    return packageManagerTarget(program, argumentsWords, scripts);
  }
  if (LAUNCHERS.has(program)) {
    return resolveCommand(launchedWords(program, argumentsWords), scripts);
  }
  return { kind: "program", name: program };
};

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
    const next = new Set([...visited, current]);
    return commandWords(script).some((words): boolean => {
      const target = resolveCommand(words, scripts);
      if (target === undefined) {
        return false;
      }
      return target.kind === "program"
        ? target.name === "vitest"
        : runsVitest(target.name, next);
    });
  };

  return runsVitest(name, new Set());
};
