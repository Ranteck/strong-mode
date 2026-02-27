import {
  PACKAGE_MANAGERS,
  type ApplyCliOptions,
  type CliOptions,
  type CreateCliOptions,
  type DoctorCliOptions,
  type PackageManager,
} from "./types.js";

const parsePackageManager = (value: string): PackageManager => {
  if (PACKAGE_MANAGERS.includes(value as PackageManager)) {
    return value as PackageManager;
  }

  throw new Error(`Unsupported package manager: ${value}`);
};

interface MutableCreateOptions {
  projectName: string | undefined;
  targetDir: string | undefined;
  packageManager: PackageManager | undefined;
  install: boolean | undefined;
  yes: boolean;
  skipGit: boolean;
}

interface MutableApplyOptions {
  cwd: string | undefined;
  packageManager: PackageManager | undefined;
  install: boolean | undefined;
  yes: boolean;
  wizard: boolean;
  dryRun: boolean;
  runChecks: boolean | undefined;
  backup: boolean;
  force: boolean;
}

const parseCreateOptions = (argv: readonly string[]): CreateCliOptions => {
  const options: MutableCreateOptions = {
    projectName: undefined,
    targetDir: undefined,
    packageManager: undefined,
    install: undefined,
    yes: false,
    skipGit: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }

    if (!token.startsWith("-")) {
      options.projectName ??= token;
      continue;
    }

    if (token === "--yes" || token === "-y") {
      options.yes = true;
      continue;
    }

    if (token === "--install") {
      options.install = true;
      continue;
    }

    if (token === "-i") {
      options.install = true;
      continue;
    }

    if (token === "--no-install" || token === "-n") {
      options.install = false;
      continue;
    }

    if (token === "--skip-git" || token === "-g") {
      options.skipGit = true;
      continue;
    }

    if (token.startsWith("--pm=")) {
      options.packageManager = parsePackageManager(token.split("=")[1] ?? "");
      continue;
    }

    if (token === "--pm" || token === "-p") {
      options.packageManager = parsePackageManager(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (token.startsWith("--dir=")) {
      options.targetDir = token.split("=")[1];
      continue;
    }

    if (token === "--dir" || token === "-d") {
      options.targetDir = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === "--apply" || token === "--up") {
      throw new Error("Use `apply` or `up` as a subcommand or at the beginning of args.");
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return {
    command: "create",
    projectName: options.projectName,
    targetDir: options.targetDir,
    packageManager: options.packageManager,
    install: options.install,
    yes: options.yes,
    skipGit: options.skipGit,
  };
};

const parseApplyOptions = (argv: readonly string[]): ApplyCliOptions => {
  const options: MutableApplyOptions = {
    cwd: undefined,
    packageManager: undefined,
    install: undefined,
    yes: false,
    wizard: false,
    dryRun: false,
    runChecks: undefined,
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

    if (token === "--wizard" || token === "-w") {
      options.wizard = true;
      continue;
    }

    if (token === "--dry-run" || token === "-d") {
      options.dryRun = true;
      continue;
    }

    if (token === "--install" || token === "-i") {
      options.install = true;
      continue;
    }

    if (token === "--no-install" || token === "-n") {
      options.install = false;
      continue;
    }

    if (token === "--check" || token === "-c") {
      options.runChecks = true;
      continue;
    }

    if (token === "--no-check" || token === "-k") {
      options.runChecks = false;
      continue;
    }

    if (token === "--backup" || token === "-b") {
      options.backup = true;
      continue;
    }

    if (token === "--force" || token === "-f") {
      options.force = true;
      continue;
    }

    if (token.startsWith("--pm=")) {
      options.packageManager = parsePackageManager(token.split("=")[1] ?? "");
      continue;
    }

    if (token === "--pm" || token === "-p") {
      options.packageManager = parsePackageManager(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (token.startsWith("--cwd=")) {
      options.cwd = token.split("=")[1];
      continue;
    }

    if (token === "--cwd" || token === "-C") {
      options.cwd = argv[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return {
    command: "apply",
    cwd: options.cwd,
    packageManager: options.packageManager,
    install: options.install,
    yes: options.yes,
    wizard: options.wizard,
    dryRun: options.dryRun,
    runChecks: options.runChecks,
    backup: options.backup,
    force: options.force,
  };
};

interface MutableDoctorOptions {
  cwd: string | undefined;
  packageManager: PackageManager | undefined;
}

const parseDoctorOptions = (argv: readonly string[]): DoctorCliOptions => {
  const options: MutableDoctorOptions = {
    cwd: undefined,
    packageManager: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }

    if (!token.startsWith("-")) {
      throw new Error(`Unknown positional argument for doctor: ${token}`);
    }

    if (token.startsWith("--pm=")) {
      options.packageManager = parsePackageManager(token.split("=")[1] ?? "");
      continue;
    }

    if (token === "--pm" || token === "-p") {
      options.packageManager = parsePackageManager(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (token.startsWith("--cwd=")) {
      options.cwd = token.split("=")[1];
      continue;
    }

    if (token === "--cwd" || token === "-C") {
      options.cwd = argv[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return {
    command: "doctor",
    cwd: options.cwd,
    packageManager: options.packageManager,
  };
};

export const parseCliArgs = (argv: readonly string[]): CliOptions => {
  const [first, ...rest] = argv;
  if (first === "apply" || first === "up") {
    return parseApplyOptions(rest);
  }

  if (first === "--apply" || first === "--up") {
    return parseApplyOptions(rest);
  }

  if (first === "create" || first === "--create") {
    return parseCreateOptions(rest);
  }

  if (first === "doctor") {
    return parseDoctorOptions(rest);
  }

  if (first === "--doctor") {
    return parseDoctorOptions(rest);
  }

  return parseCreateOptions(argv);
};
