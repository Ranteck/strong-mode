import type { PackageJsonLike } from "./types.js";
import { runScriptCommand } from "../package-manager.js";
import { runCommand } from "../process.js";
import type { PackageManager } from "../types.js";

const CHECK_SCRIPT_ORDER = ["typecheck", "lint", "test"] as const;

export const runPostApplyChecks = (
  packageManager: PackageManager,
  targetDir: string,
  packageJson: PackageJsonLike,
): readonly string[] => {
  const scripts = packageJson.scripts ?? {};
  const executed: string[] = [];

  for (const script of CHECK_SCRIPT_ORDER) {
    if (typeof scripts[script] !== "string") {
      continue;
    }

    try {
      runCommand(packageManager, runScriptCommand(script), targetDir, "inherit");
    } catch (error: unknown) {
      const isSpawnError =
        error instanceof Error && error.message.startsWith("Failed to start");
      const hint = isSpawnError
        ? `Check '${script}' could not start — is ${packageManager} installed and on PATH?`
        : `Check '${script}' failed — see output above`;
      throw new Error(hint, { cause: error });
    }
    executed.push(script);
  }

  return executed;
};
