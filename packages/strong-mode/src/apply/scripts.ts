import { PACKAGE_MANAGERS, type PackageManager } from "../types.js";

const RUN_SUBCOMMANDS = new Set(["run", "run-script"]);
const EXEC_SUBCOMMANDS = new Set(["exec", "dlx", "x"]);
const LAUNCHERS = new Set(["npx", "bunx", "pnpx", "cross-env", "env", "dotenv"]);
const ENV_ASSIGNMENT = /^[A-Za-z_]\w*=/u;
const PACKAGE_MANAGER_VALUE_OPTIONS: Readonly<
  Record<PackageManager, ReadonlySet<string>>
> = {
  npm: new Set(["--prefix", "-w", "--workspace"]),
  pnpm: new Set(["-C", "--dir", "--filter", "-F"]),
  yarn: new Set(["--cwd"]),
  bun: new Set(["--cwd", "--filter", "-F"]),
};
// pnpm's -w selects the root, so it must not make local delegation ambiguous.
// Yarn's workspace selection is handled as a subcommand below.
const PACKAGE_MANAGER_BOOLEAN_SELECTORS: Readonly<
  Record<PackageManager, ReadonlySet<string>>
> = {
  npm: new Set(["--workspaces", "-ws", "--ws"]),
  pnpm: new Set(["-r", "--recursive"]),
  yarn: new Set(),
  bun: new Set(["--workspaces"]),
};
const NPM_SCRIPT_COMMANDS = new Set(["test", "t", "tst", "start", "stop", "restart"]);
// CLI references: docs.npmjs.com/cli/v11/commands, pnpm.io/cli/help,
// classic.yarnpkg.com/en/docs/cli, yarnpkg.com/cli, bun.com/docs.
// pnpm.io/blog/releases/11.0 also lists aliases and reserved, removed commands.
// Without a Yarn version, the union avoids mistaking either CLI's commands for scripts.
const PACKAGE_MANAGER_BUILT_INS: Readonly<Record<PackageManager, ReadonlySet<string>>> =
  {
    npm: new Set([
      "access",
      "adduser",
      "approve-scripts",
      "audit",
      "bugs",
      "cache",
      "ci",
      "completion",
      "config",
      "dedupe",
      "deny-scripts",
      "deprecate",
      "diff",
      "dist-tag",
      "docs",
      "doctor",
      "edit",
      "exec",
      "explain",
      "explore",
      "find-dupes",
      "fund",
      "get",
      "help",
      "help-search",
      "init",
      "install",
      "install-ci-test",
      "install-scripts",
      "install-test",
      "link",
      "ll",
      "login",
      "logout",
      "ls",
      "org",
      "outdated",
      "owner",
      "pack",
      "ping",
      "pkg",
      "prefix",
      "profile",
      "prune",
      "publish",
      "query",
      "rebuild",
      "repo",
      "restart",
      "root",
      "run",
      "run-script",
      "sbom",
      "search",
      "set",
      "shrinkwrap",
      "stage",
      "star",
      "stars",
      "start",
      "stop",
      "team",
      "test",
      "token",
      "trust",
      "undeprecate",
      "uninstall",
      "unpublish",
      "unstar",
      "update",
      "version",
      "view",
      "whoami",
    ]),
    pnpm: new Set([
      "access",
      "add",
      "adduser",
      "approve-builds",
      "audit",
      "bin",
      "bugs",
      "c",
      "cache",
      "cat-file",
      "cat-index",
      "change",
      "ci",
      "clean",
      "clean-install",
      "completion",
      "config",
      "create",
      "dedupe",
      "deploy",
      "deprecate",
      "dist-tag",
      "dlx",
      "docs",
      "doctor",
      "edit",
      "env",
      "exec",
      "fetch",
      "find-hash",
      "help",
      "home",
      "i",
      "ic",
      "ignored-builds",
      "import",
      "info",
      "init",
      "install",
      "install-clean",
      "install-test",
      "it",
      "issues",
      "lane",
      "licenses",
      "link",
      "list",
      "login",
      "logout",
      "ls",
      "m",
      "multi",
      "outdated",
      "owner",
      "pack",
      "pack-app",
      "patch",
      "patch-commit",
      "patch-remove",
      "peers",
      "ping",
      "pipeline",
      "pkg",
      "pm",
      "pnpx",
      "pnx",
      "prefix",
      "profile",
      "prune",
      "publish",
      "rebuild",
      "recursive",
      "remove",
      "repo",
      "rm",
      "root",
      "rt",
      "run",
      "run-script",
      "runtime",
      "sbom",
      "search",
      "self-update",
      "server",
      "set-script",
      "setup",
      "shim",
      "show",
      "stage",
      "star",
      "stars",
      "start",
      "store",
      "t",
      "team",
      "test",
      "token",
      "tst",
      "un",
      "uninstall",
      "unlink",
      "unpublish",
      "unstar",
      "up",
      "update",
      "upgrade",
      "v",
      "version",
      "view",
      "whoami",
      "why",
      "with",
      "xmas",
    ]),
    yarn: new Set([
      "add",
      "audit",
      "autoclean",
      "bin",
      "cache",
      "check",
      "config",
      "constraints",
      "create",
      "dedupe",
      "dlx",
      "exec",
      "explain",
      "generate-lock-entry",
      "global",
      "help",
      "import",
      "info",
      "init",
      "install",
      "licenses",
      "link",
      "list",
      "lockfile",
      "login",
      "logout",
      "node",
      "npm",
      "outdated",
      "owner",
      "pack",
      "patch",
      "patch-commit",
      "plugin",
      "policies",
      "prune",
      "publish",
      "rebuild",
      "remove",
      "run",
      "search",
      "self-update",
      "set",
      "stage",
      "tag",
      "team",
      "test",
      "unlink",
      "unplug",
      "up",
      "upgrade",
      "upgrade-interactive",
      "version",
      "versions",
      "why",
      "workspace",
      "workspaces",
    ]),
    bun: new Set([
      "add",
      "audit",
      "build",
      "ci",
      "create",
      "dedupe",
      "help",
      "info",
      "init",
      "install",
      "link",
      "outdated",
      "patch",
      "patch-commit",
      "pm",
      "prune",
      "publish",
      "r",
      "remove",
      "repl",
      "rm",
      "run",
      "test",
      "uninstall",
      "unlink",
      "update",
      "upgrade",
      "why",
      "x",
    ]),
  };
const DIRECTORY_OPTIONS = new Set(["--prefix", "-C", "--dir", "--cwd"]);
const EXEC_VALUE_OPTIONS = new Set(["-p", "--package"]);
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

interface PackageManagerCommand {
  words: readonly string[];
  selectsPackage: boolean;
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
  const targetWords = positionalWords(
    words,
    LAUNCHER_VALUE_OPTIONS[program] ?? EMPTY_OPTIONS,
    LAUNCHER_STRING_OPTIONS[program] ?? EMPTY_OPTIONS,
    program !== "dotenv",
  );
  // dotenv's first positional word is the command, even when it looks like an assignment.
  return program === "dotenv" && ENV_ASSIGNMENT.test(targetWords[0] ?? "")
    ? []
    : targetWords;
};

const selectsOtherPackage = (
  packageManager: PackageManager,
  word: string,
  nextWord: string | undefined,
): boolean => {
  const [option = "", inlineValue] = word.split("=");
  if (PACKAGE_MANAGER_BOOLEAN_SELECTORS[packageManager].has(option)) {
    return true;
  }
  if (!PACKAGE_MANAGER_VALUE_OPTIONS[packageManager].has(option)) {
    return false;
  }
  const value = inlineValue ?? nextWord;
  return !DIRECTORY_OPTIONS.has(option) || (value !== "." && value !== "./");
};

const hasPackageSelection = (
  packageManager: PackageManager,
  words: readonly string[],
): boolean => {
  const valueOptions = new Set([
    ...PACKAGE_MANAGER_VALUE_OPTIONS[packageManager],
    ...EXEC_VALUE_OPTIONS,
    ...EXEC_STRING_OPTIONS,
  ]);
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] ?? "";
    if (word === "--") {
      break;
    }
    if (selectsOtherPackage(packageManager, word, words[index + 1])) {
      return true;
    }
    if (valueOptions.has(word)) {
      index += 1;
    }
  }
  return false;
};

const packageManagerWords = (
  packageManager: PackageManager,
  words: readonly string[],
): PackageManagerCommand => {
  const valueOptions = PACKAGE_MANAGER_VALUE_OPTIONS[packageManager];
  const targetWords = positionalWords(words, valueOptions);
  const selectsPackage = hasPackageSelection(packageManager, words);
  if (packageManager === "yarn" && targetWords[0] === "workspace") {
    return {
      words: positionalWords(targetWords.slice(2), valueOptions),
      selectsPackage: true,
    };
  }
  if (packageManager === "yarn" && targetWords[0] === "workspaces") {
    return { words: targetWords, selectsPackage: true };
  }
  return { words: targetWords, selectsPackage };
};

const runTarget = (
  packageManager: PackageManager,
  words: readonly string[],
  scripts: Readonly<Record<string, string>> | undefined,
  selectsPackage: boolean,
): CommandTarget | undefined => {
  const targetWords = positionalWords(
    words,
    PACKAGE_MANAGER_VALUE_OPTIONS[packageManager],
  );
  const name = targetWords[0];
  if (name === undefined || selectsPackage) {
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
  packageManager: PackageManager,
  words: readonly string[],
  scripts: Readonly<Record<string, string>> | undefined,
  inheritedSelection: boolean,
): CommandTarget | undefined => {
  const command = packageManagerWords(packageManager, words);
  const targetWords = command.words;
  const selectsPackage = inheritedSelection || command.selectsPackage;
  const subcommand = targetWords[0];
  if (subcommand === undefined) {
    return undefined;
  }
  const argumentsWords = targetWords.slice(1);
  if (EXEC_SUBCOMMANDS.has(subcommand)) {
    return resolveCommand(
      positionalWords(
        argumentsWords,
        new Set([
          ...PACKAGE_MANAGER_VALUE_OPTIONS[packageManager],
          ...EXEC_VALUE_OPTIONS,
        ]),
        EXEC_STRING_OPTIONS,
        true,
      ),
      scripts,
      selectsPackage,
    );
  }
  if (RUN_SUBCOMMANDS.has(subcommand)) {
    return runTarget(packageManager, argumentsWords, scripts, selectsPackage);
  }
  return shorthandTarget(packageManager, targetWords, scripts, selectsPackage);
};

const npmScriptName = (command: string): string =>
  command === "t" || command === "tst" ? "test" : command;

const shorthandTarget = (
  packageManager: PackageManager,
  words: readonly string[],
  scripts: Readonly<Record<string, string>> | undefined,
  selectsPackage: boolean,
): CommandTarget | undefined => {
  const subcommand = words[0] ?? "";
  if (packageManager === "npm" && NPM_SCRIPT_COMMANDS.has(subcommand)) {
    const name = npmScriptName(subcommand);
    return selectsPackage ? undefined : { kind: "script", name };
  }
  if (
    PACKAGE_MANAGER_BUILT_INS[packageManager].has(subcommand) ||
    packageManager === "npm"
  ) {
    return undefined;
  }
  if (scripts?.[subcommand] !== undefined) {
    // The root scripts cannot identify what another package's script runs.
    return selectsPackage ? undefined : { kind: "script", name: subcommand };
  }
  return resolveCommand(words, scripts, selectsPackage);
};

const resolveCommand = (
  words: readonly string[],
  scripts: Readonly<Record<string, string>> | undefined,
  selectsPackage = false,
): CommandTarget | undefined => {
  const index = words.findIndex((word): boolean => !ENV_ASSIGNMENT.test(word));
  const word = words[index];
  if (word === undefined) {
    return undefined;
  }
  const program = programName(word);
  const argumentsWords = words.slice(index + 1);
  const packageManager = PACKAGE_MANAGERS.find(
    (manager): boolean => manager === program,
  );
  if (packageManager !== undefined) {
    return packageManagerTarget(
      packageManager,
      argumentsWords,
      scripts,
      selectsPackage,
    );
  }
  if (LAUNCHERS.has(program)) {
    return resolveCommand(
      launchedWords(program, argumentsWords),
      scripts,
      selectsPackage,
    );
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
