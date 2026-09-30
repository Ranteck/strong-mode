const PACKAGE_MANAGERS = new Set(["npm", "pnpm", "yarn", "bun"]);
const RUN_SUBCOMMANDS = new Set(["run", "run-script"]);
const EXEC_SUBCOMMANDS = new Set(["exec", "dlx", "x"]);
const LAUNCHERS = new Set(["npx", "bunx", "pnpx", "cross-env", "env", "dotenv"]);
const ENV_ASSIGNMENT = /^[A-Za-z_]\w*=/u;
const PACKAGE_MANAGER_VALUE_OPTIONS = new Set([
  "--prefix",
  "-C",
  "--dir",
  "--filter",
  "-F",
  "--workspace",
  "-w",
  "--cwd",
]);
const EXEC_VALUE_OPTIONS = new Set(["-p", "--package"]);
const PACKAGE_MANAGER_EXEC_VALUE_OPTIONS = new Set([
  ...PACKAGE_MANAGER_VALUE_OPTIONS,
  ...EXEC_VALUE_OPTIONS,
]);
const EXEC_STRING_OPTIONS = new Set(["-c", "--call"]);
const EMPTY_OPTIONS = new Set<string>();
const LAUNCHER_VALUE_OPTIONS: Readonly<Record<string, ReadonlySet<string>>> = {
  npx: EXEC_VALUE_OPTIONS,
  pnpx: EXEC_VALUE_OPTIONS,
  bunx: EXEC_VALUE_OPTIONS,
  env: new Set(["-u", "--unset", "-C", "--chdir"]),
  dotenv: new Set(["-e", "-c", "-v"]),
};
const LAUNCHER_STRING_OPTIONS: Readonly<Record<string, ReadonlySet<string>>> = {
  npx: EXEC_STRING_OPTIONS,
  pnpx: EXEC_STRING_OPTIONS,
  bunx: EXEC_STRING_OPTIONS,
  env: new Set(["-S", "--split-string"]),
};

interface CommandTarget {
  kind: "program" | "script";
  name: string;
}

// The commands of a script (split on &&, ||, ; and |), each as its words with
// quotes stripped. Separators inside quotes are not distinguished.
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

const isSkippedWord = (word: string, skipAssignments: boolean): boolean =>
  word.startsWith("-") || (skipAssignments && ENV_ASSIGNMENT.test(word));

const positionalWords = (
  words: readonly string[],
  valueOptions: ReadonlySet<string>,
  stringOptions: ReadonlySet<string> = EMPTY_OPTIONS,
  skipAssignments = false,
): readonly string[] => {
  let skipValue = false;
  for (const [index, word] of words.entries()) {
    if (skipValue) {
      skipValue = false;
      continue;
    }
    if (stringOptions.has(word.split("=")[0] ?? "")) {
      return [];
    }
    if (valueOptions.has(word)) {
      skipValue = true;
      continue;
    }
    if (word === "--") {
      return words.slice(index + 1);
    }
    if (isSkippedWord(word, skipAssignments)) {
      continue;
    }
    return words.slice(index);
  }
  return [];
};

const launchedWords = (
  program: string,
  words: readonly string[],
): readonly string[] => {
  const separator = program === "dotenv" ? words.indexOf("--") : -1;
  if (separator !== -1) {
    return words.slice(separator + 1);
  }
  return positionalWords(
    words,
    LAUNCHER_VALUE_OPTIONS[program] ?? EMPTY_OPTIONS,
    LAUNCHER_STRING_OPTIONS[program] ?? EMPTY_OPTIONS,
    program !== "dotenv",
  );
};

const packageManagerWords = (
  packageManager: string,
  words: readonly string[],
): readonly string[] => {
  const targetWords = positionalWords(words, PACKAGE_MANAGER_VALUE_OPTIONS);
  return packageManager === "yarn" && targetWords[0] === "workspace"
    ? positionalWords(targetWords.slice(2), PACKAGE_MANAGER_VALUE_OPTIONS)
    : targetWords;
};

const runTarget = (
  packageManager: string,
  words: readonly string[],
  scripts: Readonly<Record<string, string>> | undefined,
): CommandTarget | undefined => {
  const targetWords = positionalWords(words, PACKAGE_MANAGER_VALUE_OPTIONS);
  const name = targetWords[0];
  if (name === undefined) {
    return undefined;
  }
  if (
    (packageManager === "yarn" || packageManager === "bun") &&
    scripts?.[name] === undefined
  ) {
    return resolveCommand(targetWords, scripts);
  }
  return { kind: "script", name };
};

const packageManagerTarget = (
  packageManager: string,
  words: readonly string[],
  scripts: Readonly<Record<string, string>> | undefined,
): CommandTarget | undefined => {
  const targetWords = packageManagerWords(packageManager, words);
  const subcommand = targetWords[0];
  if (subcommand === undefined) {
    return undefined;
  }
  const argumentsWords = targetWords.slice(1);
  if (EXEC_SUBCOMMANDS.has(subcommand)) {
    return resolveCommand(
      positionalWords(
        argumentsWords,
        PACKAGE_MANAGER_EXEC_VALUE_OPTIONS,
        EXEC_STRING_OPTIONS,
        true,
      ),
      scripts,
    );
  }
  if (RUN_SUBCOMMANDS.has(subcommand)) {
    return runTarget(packageManager, argumentsWords, scripts);
  }
  if (packageManager === "npm" || scripts?.[subcommand] !== undefined) {
    return { kind: "script", name: subcommand };
  }
  return resolveCommand(targetWords, scripts);
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
