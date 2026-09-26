import { createRequire } from "node:module";
import path from "node:path";
import { log } from "@clack/prompts";
import { runPostApplyChecks } from "./checks.js";
import { LOCKSTEP_DEV_DEPENDENCIES, MANAGED_FILE_DEPENDENCIES } from "./constants.js";
import { backupFile, fileExists, readTextIfExists, writeTextFile } from "./io.js";
import { isMergeableManagedFile, mergeManagedFileContent } from "./merge.js";
import { type ConflictResolution, promptFileConflictResolution } from "./prompts.js";
import type {
  AlignedLockstep,
  ApplyPlan,
  ApplySummary,
  ManagedFile,
  MismatchedLockstep,
  PackageJsonLike,
} from "./types.js";
import {
  type AddDevDependencyContext,
  addDevDependencyCommand,
  installCommand,
} from "../package-manager.js";
import { runCommand, runCommandCapture } from "../process.js";
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

type PackageJsonOutcome = "updated" | "unchanged" | "skipped";

const applyPackageJson = async (
  plan: ApplyPlan,
  options: ExecuteApplyPlanOptions,
): Promise<PackageJsonOutcome> => {
  if (!plan.packageJsonPlan.summary.changed) {
    return "unchanged";
  }

  const packageJsonPath = path.join(options.targetDir, "package.json");
  const nextSource = `${JSON.stringify(plan.packageJsonPlan.next, null, 2)}\n`;
  const currentSource = await readTextIfExists(packageJsonPath);

  if (currentSource === nextSource) {
    return "unchanged";
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
    return "skipped";
  }

  if (options.backup && currentSource !== undefined && !options.dryRun) {
    await backupFile(packageJsonPath);
  }

  if (!options.dryRun) {
    await writeTextFile(packageJsonPath, nextSource);
  }

  return "updated";
};

interface FileResults {
  readonly createdFiles: string[];
  readonly conflictedFiles: string[];
  readonly mergedFiles: string[];
  readonly overwrittenFiles: string[];
  readonly skippedFiles: string[];
  // Files whose final content is exactly the template's (created, overwritten or
  // already identical). Dependent files are only written for these.
  readonly templateFiles: Set<string>;
}

const applyNewFile = async (
  managedFile: ManagedFile,
  options: ExecuteApplyPlanOptions,
  results: FileResults,
): Promise<void> => {
  await writeManagedFile(
    options.targetDir,
    managedFile.relativePath,
    managedFile.content,
    options.dryRun,
  );
  results.createdFiles.push(managedFile.relativePath);
  results.templateFiles.add(managedFile.relativePath);
};

const applyConflictingFile = async (
  managedFile: ManagedFile,
  options: ExecuteApplyPlanOptions,
  results: FileResults,
): Promise<void> => {
  const targetPath = path.join(options.targetDir, managedFile.relativePath);
  const existing = await readTextIfExists(targetPath);
  if (existing === undefined) {
    await applyNewFile(managedFile, options, results);
    return;
  }

  if (existing === managedFile.content) {
    results.skippedFiles.push(managedFile.relativePath);
    results.templateFiles.add(managedFile.relativePath);
    return;
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
    results.skippedFiles.push(managedFile.relativePath);
    return;
  }

  const nextContent =
    decision === "merge"
      ? mergeManagedFileContent(managedFile.relativePath, existing, managedFile.content)
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
    results.conflictedFiles.push(managedFile.relativePath);
    return;
  }

  if (nextContent === existing) {
    results.skippedFiles.push(managedFile.relativePath);
    return;
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
    results.conflictedFiles.push(managedFile.relativePath);
  } else if (decision === "merge") {
    results.mergedFiles.push(managedFile.relativePath);
  } else {
    results.overwrittenFiles.push(managedFile.relativePath);
    results.templateFiles.add(managedFile.relativePath);
  }
};

const isDependentFile = (managedFile: ManagedFile): boolean =>
  MANAGED_FILE_DEPENDENCIES[managedFile.relativePath] !== undefined;

const applyDependentFiles = async (
  dependents: readonly ManagedFile[],
  options: ExecuteApplyPlanOptions,
  results: FileResults,
): Promise<void> => {
  for (const managedFile of dependents) {
    const dependency = MANAGED_FILE_DEPENDENCIES[managedFile.relativePath];
    if (dependency !== undefined && !results.templateFiles.has(dependency)) {
      log.info(
        `Skipping ${managedFile.relativePath}: ${dependency} does not use the strong-mode template.`,
      );
      results.skippedFiles.push(managedFile.relativePath);
      continue;
    }

    await applyConflictingFile(managedFile, options, results);
  }
};

// The version installed for this package, resolved the way Node resolves it from
// the project (hoisted installs, pnpm symlinks, aliases).
const resolveWithNode = async (
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

const YARN_VERSION_MARKER = "strong-mode-version=";
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[\da-z.-]+)?(?:\+[\da-z.-]+)?$/i;

// Yarn Classic wraps `yarn node` output in a banner, so the version is read
// from the marked line and only accepted when it is an exact version.
const parseYarnVersionOutput = (output: string): string | undefined => {
  const version = output
    .split(/\r?\n/)
    .find((line) => line.startsWith(YARN_VERSION_MARKER))
    ?.slice(YARN_VERSION_MARKER.length)
    .trim();
  return version !== undefined && EXACT_VERSION.test(version) ? version : undefined;
};

// Yarn PnP has no node_modules; `yarn node` runs Node with the project's PnP loader.
const resolveInstalledVersion = async (
  targetDir: string,
  packageName: string,
  packageManager: ExecuteApplyPlanOptions["packageManager"],
): Promise<string | undefined> => {
  const viaNode = await resolveWithNode(targetDir, packageName);
  if (viaNode !== undefined || packageManager !== "yarn") {
    return viaNode;
  }

  try {
    const output = runCommandCapture(
      "yarn",
      [
        "node",
        "-p",
        `${JSON.stringify(YARN_VERSION_MARKER)} + require(${JSON.stringify(`${packageName}/package.json`)}).version`,
      ],
      targetDir,
    );
    return parseYarnVersionOutput(output);
  } catch {
    return undefined;
  }
};

const readPackageJsonAt = async (dir: string): Promise<PackageJsonLike | undefined> => {
  const source = await readTextIfExists(path.join(dir, "package.json"));
  if (source === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(source) as PackageJsonLike;
  } catch {
    return undefined;
  }
};

const detectAddContext = async (
  targetDir: string,
): Promise<AddDevDependencyContext> => {
  const packageJson = await readPackageJsonAt(targetDir);
  const packageManagerField = packageJson?.packageManager;
  return {
    workspaceRoot:
      (await fileExists(path.join(targetDir, "pnpm-workspace.yaml"))) ||
      packageJson?.workspaces !== undefined,
    yarnBerry:
      (await fileExists(path.join(targetDir, ".yarnrc.yml"))) ||
      (typeof packageManagerField === "string" &&
        /^yarn@(?:[2-9]|[1-9]\d)/u.test(packageManagerField)),
  };
};

interface LockstepState {
  readonly installRan: boolean;
  readonly packageJsonSkipped: boolean;
  readonly packageJsonBackedUp: boolean;
}

interface LockstepResult {
  readonly aligned: readonly AlignedLockstep[];
  readonly deferred: readonly string[];
  readonly mismatched: readonly MismatchedLockstep[];
}

// Adds lockstep followers after install, pinned to the leader version the package
// manager actually resolved, then reads both installed versions back.
const alignLockstepAfterInstall = async (
  followers: readonly string[],
  options: ExecuteApplyPlanOptions,
  state: LockstepState,
): Promise<LockstepResult> => {
  if (followers.length === 0) {
    return { aligned: [], deferred: [], mismatched: [] };
  }
  if (!state.installRan || state.packageJsonSkipped) {
    if (state.installRan) {
      log.warn(
        `${followers.join(", ")} not added: package.json was skipped. Add it at your vitest version if you want coverage.`,
      );
    }
    return { aligned: [], deferred: [...followers], mismatched: [] };
  }

  const context = await detectAddContext(options.targetDir);
  const aligned: AlignedLockstep[] = [];
  const deferred: string[] = [];
  const mismatched: MismatchedLockstep[] = [];
  let backedUp = state.packageJsonBackedUp;

  for (const follower of followers) {
    const leader = LOCKSTEP_DEV_DEPENDENCIES[follower] ?? follower;
    const version = await resolveInstalledVersion(
      options.targetDir,
      leader,
      options.packageManager,
    );
    if (version === undefined) {
      log.warn(
        `Could not resolve the installed ${leader}, so ${follower} was not added. Add it at your ${leader} version: ${options.packageManager} ${addDevDependencyCommand(options.packageManager, `${follower}@<${leader} version>`, context).join(" ")}`,
      );
      deferred.push(follower);
      continue;
    }

    if (options.backup && !backedUp) {
      await backupFile(path.join(options.targetDir, "package.json"));
      backedUp = true;
    }

    const args = addDevDependencyCommand(
      options.packageManager,
      `${follower}@${version}`,
      context,
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

    const installedFollower = await resolveInstalledVersion(
      options.targetDir,
      follower,
      options.packageManager,
    );
    const installedLeader = await resolveInstalledVersion(
      options.targetDir,
      leader,
      options.packageManager,
    );
    if (
      installedFollower !== undefined &&
      installedLeader !== undefined &&
      installedFollower !== installedLeader
    ) {
      log.warn(
        `${follower}@${installedFollower} is installed next to ${leader}@${installedLeader}, so the pair does not match. Check overrides or resolutions in package.json or your package manager config.`,
      );
      mismatched.push({
        name: follower,
        leaderVersion: installedLeader,
        followerVersion: installedFollower,
      });
      continue;
    }

    aligned.push({
      name: follower,
      version,
      verified: installedFollower !== undefined && installedLeader !== undefined,
    });
  }

  return { aligned, deferred, mismatched };
};

export const executeApplyPlan = async (
  plan: ApplyPlan,
  options: ExecuteApplyPlanOptions,
): Promise<ApplySummary> => {
  const results: FileResults = {
    createdFiles: [],
    conflictedFiles: [],
    mergedFiles: [],
    overwrittenFiles: [],
    skippedFiles: [],
    templateFiles: new Set<string>(),
  };

  for (const managedFile of plan.filesToCreate.filter(
    (file) => !isDependentFile(file),
  )) {
    await applyNewFile(managedFile, options, results);
  }

  for (const managedFile of plan.conflictingFiles.filter(
    (file) => !isDependentFile(file),
  )) {
    await applyConflictingFile(managedFile, options, results);
  }

  // Dependent files go last so the files they depend on are already resolved.
  await applyDependentFiles(
    [...plan.filesToCreate, ...plan.conflictingFiles].filter(isDependentFile),
    options,
    results,
  );

  const { createdFiles, conflictedFiles, mergedFiles, overwrittenFiles, skippedFiles } =
    results;

  const packageJsonOutcome = await applyPackageJson(plan, options);
  let packageJsonUpdated = packageJsonOutcome === "updated";

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
  const lockstep = await alignLockstepAfterInstall(followers, options, {
    installRan,
    packageJsonSkipped: packageJsonOutcome === "skipped",
    packageJsonBackedUp: packageJsonUpdated && options.backup,
  });
  if (lockstep.aligned.length > 0 || lockstep.mismatched.length > 0) {
    packageJsonUpdated = true;
  }

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
    mismatchedLockstep: lockstep.mismatched,
    packageJsonUpdated,
    installRan,
    checksRan,
  };
};
