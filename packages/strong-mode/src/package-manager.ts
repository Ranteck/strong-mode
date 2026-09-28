import fs from "node:fs";
import path from "node:path";
import { PACKAGE_MANAGERS, type PackageManager } from "./types.js";

const LOCK_FILE_BY_PM: Readonly<Record<PackageManager, string>> = {
  npm: "package-lock.json",
  pnpm: "pnpm-lock.yaml",
  yarn: "yarn.lock",
  bun: "bun.lockb",
};

const PACKAGE_MANAGER_LABEL: Readonly<Record<PackageManager, string>> = {
  npm: "npm",
  pnpm: "pnpm",
  yarn: "yarn",
  bun: "bun",
};

export const detectPackageManager = (cwd: string): PackageManager => {
  for (const packageManager of PACKAGE_MANAGERS) {
    const lockFile = LOCK_FILE_BY_PM[packageManager];
    if (fs.existsSync(path.join(cwd, lockFile))) {
      return packageManager;
    }
  }

  const userAgent = process.env.npm_config_user_agent;
  if (typeof userAgent === "string") {
    const [rawManager] = userAgent.split("/");
    if (PACKAGE_MANAGERS.includes(rawManager as PackageManager)) {
      return rawManager as PackageManager;
    }
  }

  return "npm";
};

export const packageManagerLabel = (packageManager: PackageManager): string =>
  PACKAGE_MANAGER_LABEL[packageManager];

export const installCommand = (): readonly string[] => ["install"];

export const runScriptCommand = (script: string): readonly string[] => ["run", script];

const ADD_EXACT_DEV_FLAGS: Readonly<Record<PackageManager, readonly string[]>> = {
  npm: ["install", "--save-dev", "--save-exact"],
  pnpm: ["add", "--save-dev", "--save-exact"],
  yarn: ["add", "--dev", "--exact"],
  bun: ["add", "--dev", "--exact"],
};

export interface AddDevDependencyContext {
  // The target directory is a workspace root (pnpm-workspace.yaml or "workspaces").
  readonly workspaceRoot: boolean;
  // Yarn 2+ (Berry), which has no workspace-root check and rejects its flag.
  readonly yarnBerry: boolean;
}

// pnpm and Yarn Classic refuse to add to a workspace root without an explicit opt-in.
const workspaceRootFlags = (
  packageManager: PackageManager,
  context: AddDevDependencyContext,
): readonly string[] => {
  if (!context.workspaceRoot) {
    return [];
  }
  if (packageManager === "pnpm") {
    return ["--workspace-root"];
  }
  if (packageManager === "yarn" && !context.yarnBerry) {
    return ["--ignore-workspace-root-check"];
  }
  return [];
};

export const addDevDependencyCommand = (
  packageManager: PackageManager,
  spec: string,
  context: AddDevDependencyContext = { workspaceRoot: false, yarnBerry: false },
): readonly string[] => [
  ...ADD_EXACT_DEV_FLAGS[packageManager],
  ...workspaceRootFlags(packageManager, context),
  spec,
];
