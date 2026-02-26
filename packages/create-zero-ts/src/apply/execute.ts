import path from "node:path";
import { runPostApplyChecks } from "./checks.js";
import { backupFile, readTextIfExists, writeTextFile } from "./io.js";
import { promptFileConflictResolution } from "./prompts.js";
import type { ApplyPlan, ApplyProgressEvent, ApplySummary } from "./types.js";
import { installCommand } from "../package-manager.js";
import { runCommand } from "../process.js";
import type { PackageManager } from "../types.js";

export interface ExecuteApplyPlanOptions {
  readonly targetDir: string;
  readonly packageManager: PackageManager;
  readonly conflictPolicy: "review" | "skip" | "overwrite";
  readonly dryRun: boolean;
  readonly backup: boolean;
  readonly shouldInstall: boolean;
  readonly shouldRunChecks: boolean;
  readonly onProgress?: (event: ApplyProgressEvent) => void;
}

const emitProgress = (
  options: ExecuteApplyPlanOptions,
  stage: ApplyProgressEvent["stage"],
  message: string,
): void => {
  options.onProgress?.({ stage, message });
};

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

  if (currentSource === undefined) {
    if (!options.dryRun) {
      await writeTextFile(packageJsonPath, nextSource);
    }
    return true;
  }

  if (options.conflictPolicy === "skip") {
    return false;
  }

  const decision = options.conflictPolicy === "overwrite"
    ? { action: "overwrite" as const, content: nextSource }
    : await promptFileConflictResolution("package.json", currentSource, nextSource);

  if (decision.action === "skip") {
    return false;
  }

  const finalContent = "content" in decision ? decision.content : nextSource;

  if (options.backup && !options.dryRun) {
    await backupFile(packageJsonPath);
  }

  if (!options.dryRun) {
    await writeTextFile(packageJsonPath, finalContent);
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

  emitProgress(
    options,
    "creating_files",
    `Creating ${String(plan.filesToCreate.length)} new managed file(s).`,
  );

  for (const managedFile of plan.filesToCreate) {
    await writeManagedFile(
      options.targetDir,
      managedFile.relativePath,
      managedFile.content,
      options.dryRun,
    );
    createdFiles.push(managedFile.relativePath);
  }

  emitProgress(
    options,
    "resolving_conflicts",
    `Resolving ${String(plan.conflictingFiles.length)} conflicting managed file(s).`,
  );

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

    if (options.conflictPolicy === "skip") {
      skippedFiles.push(managedFile.relativePath);
      continue;
    }

    const decision = options.conflictPolicy === "overwrite"
      ? { action: "overwrite" as const, content: managedFile.content }
      : await promptFileConflictResolution(
        managedFile.relativePath,
        existing,
        managedFile.content,
      );

    if (decision.action === "skip") {
      skippedFiles.push(managedFile.relativePath);
      continue;
    }

    const finalContent = "content" in decision ? decision.content : managedFile.content;

    if (options.backup && !options.dryRun) {
      await backupFile(targetPath);
    }

    await writeManagedFile(
      options.targetDir,
      managedFile.relativePath,
      finalContent,
      options.dryRun,
    );
    overwrittenFiles.push(managedFile.relativePath);
  }

  emitProgress(options, "updating_package_json", "Updating package.json plan.");
  const packageJsonUpdated = await applyPackageJson(plan, options);

  let installRan = false;
  emitProgress(
    options,
    "installing_dependencies",
    options.shouldInstall ? "Installing dependencies." : "Skipping dependency install.",
  );
  if (options.shouldInstall) {
    if (!options.dryRun) {
      runCommand(
        options.packageManager,
        installCommand(options.packageManager),
        options.targetDir,
        "inherit",
      );
    }
    installRan = true;
  }

  let checksRan: readonly string[] = [];
  emitProgress(
    options,
    "running_checks",
    options.shouldRunChecks ? "Running post-apply checks." : "Skipping post-apply checks.",
  );
  if (options.shouldRunChecks) {
    if (options.dryRun) {
      checksRan = ["typecheck", "lint", "test"];
    } else {
      const packageJsonForChecks =
        packageJsonUpdated
          ? plan.packageJsonPlan.next
          : (plan.packageJsonPlan.current ?? plan.packageJsonPlan.next);
      checksRan = runPostApplyChecks(options.packageManager, options.targetDir, packageJsonForChecks);
    }
  }

  emitProgress(options, "completed", "Apply execution completed.");

  return {
    createdFiles,
    overwrittenFiles,
    skippedFiles,
    packageJsonUpdated,
    installRan,
    checksRan,
  };
};
