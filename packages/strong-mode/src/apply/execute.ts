import path from "node:path";
import { log } from "@clack/prompts";
import { runPostApplyChecks } from "./checks.js";
import {
  LOCKSTEP_DEV_DEPENDENCIES,
  MANAGED_FILE_DEPENDENCIES,
  REPLACED_DEV_DEPENDENCIES,
  VITEST_TEST_FILES,
} from "./constants.js";
import { readInstalledVersion } from "./installed.js";
import { backupFile, fileExists, readTextIfExists, writeTextFile } from "./io.js";
import { isMergeableManagedFile, mergeManagedFileContent } from "./merge.js";
import { dropReplacedDependencies } from "./patchers.js";
import { scriptRunsVitest } from "./scripts.js";
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
  next: PackageJsonLike,
  options: ExecuteApplyPlanOptions,
): Promise<PackageJsonOutcome> => {
  if (!plan.packageJsonPlan.summary.changed && next === plan.packageJsonPlan.next) {
    return "unchanged";
  }

  const packageJsonPath = path.join(options.targetDir, "package.json");
  const nextSource = `${JSON.stringify(next, null, 2)}\n`;
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
  readonly deferredFiles: string[];
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

const hasOtherTestRunner = (packageJson: PackageJsonLike | undefined): boolean =>
  ["jest", "@playwright/test", "mocha", "ava", "jasmine"].some(
    (runner): boolean =>
      Object.hasOwn(packageJson?.dependencies ?? {}, runner) ||
      Object.hasOwn(packageJson?.devDependencies ?? {}, runner),
  );

const applyDependentFiles = async (
  dependents: readonly ManagedFile[],
  packageJson: PackageJsonLike | undefined,
  options: ExecuteApplyPlanOptions,
  results: FileResults,
): Promise<void> => {
  for (const managedFile of dependents) {
    if (
      VITEST_TEST_FILES.has(managedFile.relativePath) &&
      (hasOtherTestRunner(packageJson) || !scriptRunsVitest(packageJson?.scripts))
    ) {
      log.info(
        `Skipping ${managedFile.relativePath}: the project's "test" script could not be confirmed to run only Vitest. You can add the file if it does.`,
      );
      results.skippedFiles.push(managedFile.relativePath);
      continue;
    }

    const dependency = MANAGED_FILE_DEPENDENCIES[managedFile.relativePath];
    if (dependency !== undefined && results.conflictedFiles.includes(dependency)) {
      log.warn(
        `Not adding ${managedFile.relativePath} yet: resolve the conflict in ${dependency} and re-run strong-mode.`,
      );
      results.deferredFiles.push(managedFile.relativePath);
      continue;
    }

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
  const viaNode = await readInstalledVersion(targetDir, packageName);
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

// ESLint configs other than the managed eslint.config.mjs. ESLint loads
// eslint.config.js first; the others may still be selected with --config.
const OTHER_ESLINT_CONFIGS = [
  "eslint.config.js",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yaml",
  ".eslintrc.yml",
] as const;
const RUNS_ESLINT = /\beslint\b/u;
const SELECTS_ESLINT_CONFIG = /(?:^|\s)(?:-c|--config)(?:\s|=)/u;

const findOtherEslintConfigs = async (targetDir: string): Promise<string[]> => {
  const exists = await Promise.all(
    OTHER_ESLINT_CONFIGS.map((file) => fileExists(path.join(targetDir, file))),
  );
  return OTHER_ESLINT_CONFIGS.filter((_file, index) => exists[index] === true);
};

const warnIfEslintConfigShadowed = async (targetDir: string): Promise<void> => {
  if (await fileExists(path.join(targetDir, "eslint.config.js"))) {
    log.warn(
      "eslint.config.js takes precedence over strong-mode's eslint.config.mjs, so ESLint keeps using it and the strong-mode rules do not apply. Merge them into eslint.config.js, or remove it.",
    );
  }
};

// Why a replaced package may still be loaded by something strong-mode does not
// manage, if anything does.
const replacedPackageConsumer = async (
  next: PackageJsonLike,
  targetDir: string,
): Promise<string | undefined> => {
  if ((await detectAddContext(targetDir)).workspaceRoot) {
    return "other workspace packages may still use it";
  }
  const otherConfigs = await findOtherEslintConfigs(targetDir);
  if (otherConfigs.length > 0) {
    return `${otherConfigs.join(", ")} may still load it`;
  }
  // Any script, not only `lint`: scripts delegate to each other, and keeping an
  // extra package is cheaper than breaking the config that still loads it.
  const selecting = Object.entries(next.scripts ?? {}).find(
    ([, script]) => RUNS_ESLINT.test(script) && SELECTS_ESLINT_CONFIG.test(script),
  );
  return selecting === undefined
    ? undefined
    : `the "${selecting[0]}" script selects another ESLint config (${selecting[1]})`;
};

// Replaced packages can only go once their config file is known to be the
// template's, and nothing else strong-mode does not manage may still load them.
const withoutReplacedDependencies = async (
  next: PackageJsonLike,
  results: FileResults,
  options: ExecuteApplyPlanOptions,
): Promise<PackageJsonLike> => {
  const replaced = dropReplacedDependencies(next, results.templateFiles);
  if (replaced.dropped.length === 0) {
    return next;
  }

  const consumer = await replacedPackageConsumer(next, options.targetDir);
  if (consumer !== undefined) {
    for (const name of replaced.dropped) {
      log.warn(`Keeping ${name}: ${consumer}. Remove it once nothing uses it.`);
    }
    return next;
  }

  for (const name of replaced.dropped) {
    log.info(
      `Removing ${name}: replaced by ${REPLACED_DEV_DEPENDENCIES[name]?.replacement ?? "a newer package"}.`,
    );
  }
  return replaced.next;
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
    deferredFiles: [],
    templateFiles: new Set<string>(),
  };

  await warnIfEslintConfigShadowed(options.targetDir);

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

  const nextPackageJson = await withoutReplacedDependencies(
    plan.packageJsonPlan.next,
    results,
    options,
  );
  const packageJsonOutcome = await applyPackageJson(plan, nextPackageJson, options);
  let packageJsonUpdated = packageJsonOutcome === "updated";

  // Dependent files go last so the files they depend on are already resolved, and
  // follow the package.json that is kept: the current one when its update was skipped.
  await applyDependentFiles(
    [...plan.filesToCreate, ...plan.conflictingFiles].filter(isDependentFile),
    packageJsonOutcome === "skipped" ? plan.packageJsonPlan.current : nextPackageJson,
    options,
    results,
  );

  const { createdFiles, conflictedFiles, mergedFiles, overwrittenFiles, skippedFiles } =
    results;

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
      ? nextPackageJson
      : (plan.packageJsonPlan.current ?? nextPackageJson);
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
    deferredFiles: results.deferredFiles,
    packageJsonUpdated,
    installRan,
    checksRan,
  };
};
