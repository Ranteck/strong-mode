import { createRequire } from "node:module";
import path from "node:path";
import { log } from "@clack/prompts";
import { runPostApplyChecks } from "./checks.js";
import { LOCKSTEP_DEV_DEPENDENCIES } from "./constants.js";
import { backupFile, readTextIfExists, writeTextFile } from "./io.js";
import { isMergeableManagedFile, mergeManagedFileContent } from "./merge.js";
import { type ConflictResolution, promptFileConflictResolution } from "./prompts.js";
import type { ApplyPlan, ApplySummary } from "./types.js";
import { addDevDependencyCommand, installCommand } from "../package-manager.js";
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

const stripTrailingNewlines = (content: string): string => content.replace(/\n+$/u, "");

const buildConflictFileContent = (
  existingContent: string,
  incomingContent: string,
): string =>
  [
    "<<<<<<< current project",
    stripTrailingNewlines(existingContent),
    "=======",
    stripTrailingNewlines(incomingContent),
    ">>>>>>> strong-mode template",
    "",
  ].join("\n");

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
    log.warn(
      "No package.json found in target directory — will create one from template.",
    );
    decision = "overwrite";
  } else {
    decision = await promptFileConflictResolution(
      "package.json",
      currentSource,
      nextSource,
      options.yes,
      options.force,
      "package-json",
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

// The version the package manager installed for this package, resolved the way
// Node resolves it from the project (hoisted installs, pnpm symlinks, aliases).
const resolveInstalledVersion = async (
  targetDir: string,
  packageName: string,
): Promise<string | undefined> => {
  let manifestPath: string;
  try {
    manifestPath = createRequire(path.join(targetDir, "package.json")).resolve(
      `${packageName}/package.json`,
    );
  } catch {
    return undefined;
  }

  const source = await readTextIfExists(manifestPath);
  if (source === undefined) {
    return undefined;
  }

  try {
    const manifest = JSON.parse(source) as { version?: unknown };
    return typeof manifest.version === "string" && manifest.version.length > 0
      ? manifest.version
      : undefined;
  } catch {
    return undefined;
  }
};

// Adds lockstep followers after install, pinned to the leader version the package
// manager actually resolved, so the pair can never mismatch.
const alignLockstepAfterInstall = async (
  followers: readonly string[],
  options: ExecuteApplyPlanOptions,
  installRan: boolean,
): Promise<{
  readonly aligned: readonly { readonly name: string; readonly version: string }[];
  readonly deferred: readonly string[];
}> => {
  const aligned: { readonly name: string; readonly version: string }[] = [];
  const deferred: string[] = [];

  for (const follower of followers) {
    const leader = LOCKSTEP_DEV_DEPENDENCIES[follower] ?? follower;
    const version = installRan
      ? await resolveInstalledVersion(options.targetDir, leader)
      : undefined;
    if (version === undefined) {
      if (installRan) {
        log.warn(
          `Could not resolve the installed ${leader}, so ${follower} was not added. Add it at your ${leader} version: ${options.packageManager} ${addDevDependencyCommand(options.packageManager, `${follower}@<${leader} version>`).join(" ")}`,
        );
      }
      deferred.push(follower);
      continue;
    }

    const args = addDevDependencyCommand(
      options.packageManager,
      `${follower}@${version}`,
    );
    try {
      // runCommand is synchronous (spawnSync) — if refactored to async, add await here
      runCommand(options.packageManager, args, options.targetDir, "inherit");
    } catch (error: unknown) {
      throw new Error(
        `Adding ${follower}@${version} failed after install. Rerun \`${options.packageManager} ${args.join(" ")}\`.`,
        { cause: error },
      );
    }
    aligned.push({ name: follower, version });
  }

  return { aligned, deferred };
};

export const executeApplyPlan = async (
  plan: ApplyPlan,
  options: ExecuteApplyPlanOptions,
): Promise<ApplySummary> => {
  const createdFiles: string[] = [];
  const conflictedFiles: string[] = [];
  const mergedFiles: string[] = [];
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
      isMergeableManagedFile(managedFile.relativePath)
        ? "mergeable-file"
        : "managed-file",
    );

    if (decision === "skip") {
      skippedFiles.push(managedFile.relativePath);
      continue;
    }

    const nextContent =
      decision === "merge"
        ? mergeManagedFileContent(
            managedFile.relativePath,
            existing,
            managedFile.content,
          )
        : decision === "conflict"
          ? buildConflictFileContent(existing, managedFile.content)
          : managedFile.content;

    if (decision === "merge" && nextContent === undefined) {
      if (options.backup && !options.dryRun) {
        await backupFile(targetPath);
      }

      await writeManagedFile(
        options.targetDir,
        managedFile.relativePath,
        buildConflictFileContent(existing, managedFile.content),
        options.dryRun,
      );
      conflictedFiles.push(managedFile.relativePath);
      continue;
    }

    if (nextContent === existing) {
      skippedFiles.push(managedFile.relativePath);
      continue;
    }

    if (nextContent === undefined) {
      throw new Error(
        `Merge strategy did not produce content for ${managedFile.relativePath}.`,
      );
    }

    if (options.backup && !options.dryRun) {
      await backupFile(targetPath); // throws with context if backup fails — overwrite will not proceed
    }

    await writeManagedFile(
      options.targetDir,
      managedFile.relativePath,
      nextContent,
      options.dryRun,
    );

    if (decision === "conflict") {
      conflictedFiles.push(managedFile.relativePath);
    } else if (decision === "merge") {
      mergedFiles.push(managedFile.relativePath);
    } else {
      overwrittenFiles.push(managedFile.relativePath);
    }
  }

  const packageJsonUpdated = await applyPackageJson(plan, options);

  let installRan = false;
  if (options.shouldInstall && conflictedFiles.length === 0 && !options.dryRun) {
    const installArgs = installCommand();
    try {
      // runCommand is synchronous (spawnSync) — if refactored to async, add await here
      runCommand(options.packageManager, installArgs, options.targetDir, "inherit");
      installRan = true;
    } catch (error: unknown) {
      throw new Error(
        `Install failed after apply wrote project changes (created: ${String(createdFiles.length)}, overwritten: ${String(overwrittenFiles.length)}, package.json updated: ${packageJsonUpdated ? "yes" : "no"}). The project may be in a partial state. Review changes and rerun \`${options.packageManager} ${installArgs.join(" ")}\`.`,
        { cause: error },
      );
    }
  }

  const followers = plan.packageJsonPlan.summary.postInstallLockstep;
  if (!installRan && options.shouldInstall && !options.dryRun && followers.length > 0) {
    log.warn(
      `${followers.join(", ")} not added: install was skipped because of unresolved conflicts. Resolve them and re-run strong-mode.`,
    );
  }
  const lockstep = await alignLockstepAfterInstall(followers, options, installRan);

  let checksRan: readonly string[] = [];
  if (options.shouldRunChecks && conflictedFiles.length === 0 && !options.dryRun) {
    const packageJsonForChecks = packageJsonUpdated
      ? plan.packageJsonPlan.next
      : (plan.packageJsonPlan.current ?? plan.packageJsonPlan.next);
    try {
      // runCommand is synchronous (spawnSync) — if refactored to async, add await here
      checksRan = runPostApplyChecks(
        options.packageManager,
        options.targetDir,
        packageJsonForChecks,
      );
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
    conflictedFiles,
    mergedFiles,
    overwrittenFiles,
    skippedFiles,
    alignedLockstep: lockstep.aligned,
    deferredLockstep: lockstep.deferred,
    packageJsonUpdated,
    installRan,
    checksRan,
  };
};
