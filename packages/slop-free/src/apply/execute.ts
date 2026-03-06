import path from "node:path";
import { log } from "@clack/prompts";
import { runPostApplyChecks } from "./checks.js";
import { backupFile, readTextIfExists, writeTextFile } from "./io.js";
import { type ConflictResolution, promptFileConflictResolution } from "./prompts.js";
import type { ApplyPlan, ApplySummary } from "./types.js";
import { installCommand } from "../package-manager.js";
import { runCommand } from "../process.js";
import type { PackageManager } from "../types.js";

export interface ExecuteApplyPlanOptions {
  readonly targetDir: string;
  readonly packageManager: PackageManager;
  readonly yes: boolean;
  readonly force: boolean;
  readonly dryRun: boolean;
  readonly backup: boolean;
  readonly shouldInstall: boolean;
  readonly shouldRunChecks: boolean;
}

const writeManagedFile = async (
  targetDir: string,
  relativePath: string,
  content: string,
  dryRun: boolean,
): Promise<void> => {
  if (dryRun) {
    return;
  }

  await writeTextFile(path.join(targetDir, relativePath), content);
};

const applyPackageJson = async (
  plan: ApplyPlan,
  options: ExecuteApplyPlanOptions,
): Promise<boolean> => {
  if (!plan.packageJsonPlan.summary.changed) {
    return false;
  }

  const packageJsonPath = path.join(options.targetDir, "package.json");
  const nextSource = `${JSON.stringify(plan.packageJsonPlan.next, null, 2)}\n`;
  const currentSource = await readTextIfExists(packageJsonPath);

  if (currentSource === nextSource) {
    return false;
  }

  let decision: ConflictResolution;
  if (currentSource === undefined) {
    log.warn("No package.json found in target directory — will create one from template.");
    decision = "overwrite";
  } else {
    decision = await promptFileConflictResolution(
      "package.json",
      currentSource,
      nextSource,
      options.yes,
      options.force,
    );
  }

  if (decision === "skip") {
    return false;
  }

  if (options.backup && currentSource !== undefined && !options.dryRun) {
    await backupFile(packageJsonPath);
  }

  if (!options.dryRun) {
    await writeTextFile(packageJsonPath, nextSource);
  }

  return true;
};

export const executeApplyPlan = async (
  plan: ApplyPlan,
  options: ExecuteApplyPlanOptions,
): Promise<ApplySummary> => {
  const createdFiles: string[] = [];
  const overwrittenFiles: string[] = [];
  const skippedFiles: string[] = [];

  for (const managedFile of plan.filesToCreate) {
    await writeManagedFile(
      options.targetDir,
      managedFile.relativePath,
      managedFile.content,
      options.dryRun,
    );
    createdFiles.push(managedFile.relativePath);
  }

  for (const managedFile of plan.conflictingFiles) {
    const targetPath = path.join(options.targetDir, managedFile.relativePath);
    const existing = await readTextIfExists(targetPath);
    if (existing === undefined) {
      await writeManagedFile(
        options.targetDir,
        managedFile.relativePath,
        managedFile.content,
        options.dryRun,
      );
      createdFiles.push(managedFile.relativePath);
      continue;
    }

    if (existing === managedFile.content) {
      skippedFiles.push(managedFile.relativePath);
      continue;
    }

    const decision = await promptFileConflictResolution(
      managedFile.relativePath,
      existing,
      managedFile.content,
      options.yes,
      options.force,
    );

    if (decision === "skip") {
      skippedFiles.push(managedFile.relativePath);
      continue;
    }

    if (options.backup && !options.dryRun) {
      await backupFile(targetPath); // throws with context if backup fails — overwrite will not proceed
    }

    await writeManagedFile(
      options.targetDir,
      managedFile.relativePath,
      managedFile.content,
      options.dryRun,
    );
    overwrittenFiles.push(managedFile.relativePath);
  }

  const packageJsonUpdated = await applyPackageJson(plan, options);

  let installRan = false;
  if (options.shouldInstall && !options.dryRun) {
    const installArgs = installCommand();
    try {
      // runCommand is synchronous (spawnSync) — if refactored to async, add await here
      runCommand(
        options.packageManager,
        installArgs,
        options.targetDir,
        "inherit",
      );
      installRan = true;
    } catch (error: unknown) {
      throw new Error(
        `Install failed after apply wrote project changes (created: ${String(createdFiles.length)}, overwritten: ${String(overwrittenFiles.length)}, package.json updated: ${packageJsonUpdated ? "yes" : "no"}). The project may be in a partial state. Review changes and rerun \`${options.packageManager} ${installArgs.join(" ")}\`.`,
        { cause: error },
      );
    }
  }

  let checksRan: readonly string[] = [];
  if (options.shouldRunChecks && !options.dryRun) {
    const packageJsonForChecks =
      packageJsonUpdated
        ? plan.packageJsonPlan.next
        : (plan.packageJsonPlan.current ?? plan.packageJsonPlan.next);
    try {
      // runCommand is synchronous (spawnSync) — if refactored to async, add await here
      checksRan = runPostApplyChecks(options.packageManager, options.targetDir, packageJsonForChecks);
    } catch (error: unknown) {
      throw new Error(
        `Post-apply check failed (apply already wrote project changes — ` +
        `created: ${String(createdFiles.length)}, overwritten: ${String(overwrittenFiles.length)}, ` +
        `package.json updated: ${packageJsonUpdated ? "yes" : "no"}). ` +
        `Review changes then fix the check failure.`,
        { cause: error },
      );
    }
  }

  return {
    createdFiles,
    overwrittenFiles,
    skippedFiles,
    packageJsonUpdated,
    installRan,
    checksRan,
  };
};
