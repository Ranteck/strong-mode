import {
  PACKAGE_MANAGERS,
  type ApplyCliOptions,
  type PackageManager,
} from "./types.js";

const parsePackageManager = (value: string): PackageManager => {
  if (PACKAGE_MANAGERS.includes(value as PackageManager)) {
    return value as PackageManager;
  }

  throw new Error(`Unsupported package manager: ${value}`);
};

const parseFlagValue = (flag: string, value: string | undefined): string => {
  if (value === undefined || value.length === 0 || value.startsWith("-")) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
};

interface MutableApplyOptions {
  cwd?: string;
  packageManager?: PackageManager;
  install?: boolean;
  runChecks?: boolean;
  yes: boolean;
  dryRun: boolean;
  backup: boolean;
  force: boolean;
}

const parseApplyOptions = (argv: readonly string[]): ApplyCliOptions => {
  const options: MutableApplyOptions = {
    yes: false,
    dryRun: false,
    backup: false,
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }

    if (!token.startsWith("-")) {
      throw new Error(`Unknown positional argument for apply: ${token}`);
    }

    if (token === "--yes" || token === "-y") {
      options.yes = true;
      continue;
    }

    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (token === "--install") {
      options.install = true;
      continue;
    }

    if (token === "--no-install") {
      options.install = false;
      continue;
    }

    if (token === "--check") {
      options.runChecks = true;
      continue;
    }

    if (token === "--no-check") {
      options.runChecks = false;
      continue;
    }

    if (token === "--backup") {
      options.backup = true;
      continue;
    }

    if (token === "--force") {
      options.force = true;
      continue;
    }

    if (token.startsWith("--pm=")) {
      options.packageManager = parsePackageManager(parseFlagValue("--pm", token.slice("--pm=".length)));
      continue;
    }

    if (token === "--pm") {
      options.packageManager = parsePackageManager(parseFlagValue("--pm", argv[index + 1]));
      index += 1;
      continue;
    }

    if (token.startsWith("--cwd=")) {
      options.cwd = parseFlagValue("--cwd", token.slice("--cwd=".length));
      continue;
    }

    if (token === "--cwd") {
      options.cwd = parseFlagValue("--cwd", argv[index + 1]);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return {
    command: "apply",
    yes: options.yes,
    dryRun: options.dryRun,
    backup: options.backup,
    force: options.force,
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.packageManager === undefined ? {} : { packageManager: options.packageManager }),
    ...(options.install === undefined ? {} : { install: options.install }),
    ...(options.runChecks === undefined ? {} : { runChecks: options.runChecks }),
  } as const satisfies ApplyCliOptions;
};

export const parseCliArgs = (argv: readonly string[]): ApplyCliOptions =>
  parseApplyOptions(argv);
