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
