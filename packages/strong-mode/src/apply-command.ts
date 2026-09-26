import { confirm, log, select } from "@clack/prompts";
import { stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { detectApplyInput } from "./apply/detect.js";
import { LOCKSTEP_DEV_DEPENDENCIES } from "./apply/constants.js";
import { executeApplyPlan } from "./apply/execute.js";
import { assertEsmProject } from "./apply/module-system.js";
import { buildApplyPlan } from "./apply/plan.js";
import { detectPackageManager, packageManagerLabel } from "./package-manager.js";
import { resolveTemplateDir } from "./template.js";
import {
  PACKAGE_MANAGERS,
  type ApplyCliOptions,
  type PackageManager,
} from "./types.js";
import {
  exitOnCancel,
  formatKeyValue,
  formatPackageManagerOption,
  formatPath,
  formatSectionTitle,
} from "./ui.js";

const choosePackageManager = async (
  initialValue: PackageManager,
  yes: boolean,
): Promise<PackageManager> => {
  if (yes) {
    return initialValue;
  }

  const selected = await select({
    message: "Pick a package manager for install/check commands",
    initialValue,
    options: PACKAGE_MANAGERS.map((packageManager) => ({
      value: packageManager,
      label: formatPackageManagerOption(
        packageManager,
        packageManagerLabel(packageManager),
      ),
    })),
  });

  return exitOnCancel(selected);
};

const resolveInstallDecision = async (
  installFlag: boolean | undefined,
  yes: boolean,
  recommended: boolean,
  packageManager: PackageManager,
): Promise<boolean> => {
  if (installFlag !== undefined) {
    return installFlag;
  }

  if (yes) {
    return recommended;
  }

  const selected = await confirm({
    message: `Install dependencies with ${packageManagerLabel(packageManager)}?`,
    initialValue: recommended,
  });

  return exitOnCancel(selected);
};

const resolveCheckDecision = async (
  checkFlag: boolean | undefined,
  yes: boolean,
): Promise<boolean> => {
  if (checkFlag !== undefined) {
    return checkFlag;
  }

  if (yes) {
    return true;
  }

  const selected = await confirm({
    message: "Run typecheck, lint, and test after apply?",
    initialValue: true,
  });

  return exitOnCancel(selected);
};

const summarizePlan = (plan: ReturnType<typeof buildApplyPlan>): readonly string[] => [
  formatSectionTitle("Plan Summary"),
  formatKeyValue("Project name", plan.projectName, "info"),
  formatKeyValue("Files to create", String(plan.filesToCreate.length), "info"),
  formatKeyValue(
    "Files with conflicts",
    String(plan.conflictingFiles.length),
    "warning",
  ),
  formatKeyValue(
    "Package.json changed",
    plan.packageJsonPlan.summary.changed ? "yes" : "no",
    plan.packageJsonPlan.summary.changed ? "warning" : "neutral",
  ),
  formatKeyValue(
    "Dependencies to add",
    String(plan.packageJsonPlan.summary.addedDependencies.length),
    plan.packageJsonPlan.summary.addedDependencies.length > 0 ? "warning" : "neutral",
  ),
  formatKeyValue(
    "Dev dependencies to add",
    String(plan.packageJsonPlan.summary.addedDevDependencies.length),
    plan.packageJsonPlan.summary.addedDevDependencies.length > 0
      ? "warning"
      : "neutral",
  ),
  ...(plan.packageJsonPlan.summary.postInstallLockstep.length > 0
    ? [
        formatKeyValue(
          "After install",
          plan.packageJsonPlan.summary.postInstallLockstep
            .map(
              (follower) =>
                `${follower} (pinned to the installed ${LOCKSTEP_DEV_DEPENDENCIES[follower] ?? follower})`,
            )
            .join(", "),
          "info",
        ),
      ]
    : []),
];

const summarizeResult = (
  result: Awaited<ReturnType<typeof executeApplyPlan>>,
  dryRun: boolean,
  shouldInstall: boolean,
  shouldRunChecks: boolean,
): readonly string[] => {
  const hasConflicts = result.conflictedFiles.length > 0;

  const installSummary =
    hasConflicts && shouldInstall
      ? dryRun
        ? "would skip due to unresolved conflicts"
        : "skipped due to unresolved conflicts"
      : dryRun
        ? shouldInstall
          ? "would run"
          : "skipped"
        : result.installRan
          ? "yes"
          : "no";

  const checksSummary =
    hasConflicts && shouldRunChecks
      ? dryRun
        ? "would skip due to unresolved conflicts"
        : "skipped due to unresolved conflicts"
      : dryRun
        ? shouldRunChecks
          ? "would run"
          : "skipped"
        : result.checksRan.length > 0
          ? result.checksRan.join(", ")
          : "none";

  return [
    formatSectionTitle(dryRun ? "Dry-run Result" : "Apply Result"),
    formatKeyValue("Created files", String(result.createdFiles.length), "success"),
    formatKeyValue(
      "Merged files",
      String(result.mergedFiles.length),
      result.mergedFiles.length > 0 ? "success" : "neutral",
    ),
    formatKeyValue(
      "Conflicted files",
      String(result.conflictedFiles.length),
      result.conflictedFiles.length > 0 ? "warning" : "neutral",
    ),
    formatKeyValue(
      "Overwritten files",
      String(result.overwrittenFiles.length),
      result.overwrittenFiles.length > 0 ? "warning" : "neutral",
    ),
    formatKeyValue("Skipped files", String(result.skippedFiles.length), "neutral"),
    ...(result.alignedLockstep.length > 0
      ? [
          formatKeyValue(
            "Aligned after install",
            result.alignedLockstep
              .map(
                ({ name, version, verified }) =>
                  `${name}@${version}${verified ? "" : " (unverified)"}`,
              )
              .join(", "),
            "success",
          ),
        ]
      : []),
    ...(result.mismatchedLockstep.length > 0
      ? [
          formatKeyValue(
            "Mismatched after install",
            result.mismatchedLockstep
              .map(
                ({ name, followerVersion, leaderVersion }) =>
                  `${name}@${followerVersion} vs ${leaderVersion} (check overrides or resolutions)`,
              )
              .join(", "),
            "warning",
          ),
        ]
      : []),
    ...(!dryRun && result.deferredLockstep.length > 0
      ? [
          formatKeyValue(
            "Deferred dev dependencies",
            `${result.deferredLockstep.join(", ")} (install dependencies and re-run strong-mode)`,
            "warning",
          ),
        ]
      : []),
    formatKeyValue(
      "Package.json updated",
      result.packageJsonUpdated ? "yes" : "no",
      result.packageJsonUpdated ? "success" : "neutral",
    ),
    formatKeyValue(
      dryRun ? "Install" : "Install ran",
      installSummary,
      hasConflicts ? "warning" : result.installRan ? "success" : "neutral",
    ),
    formatKeyValue(
      dryRun ? "Checks" : "Checks ran",
      checksSummary,
      hasConflicts ? "warning" : result.checksRan.length > 0 ? "success" : "neutral",
    ),
  ];
};

export const runApplyCommand = async (
  options: ApplyCliOptions,
): Promise<readonly string[]> => {
  const targetDir = path.resolve(process.cwd(), options.cwd ?? ".");
  const targetStat = await stat(targetDir).catch((): undefined => undefined);
  if (targetStat === undefined) {
    throw new Error(`Target directory does not exist: ${targetDir}`);
  }
  if (!targetStat.isDirectory()) {
    throw new Error(`Target path is not a directory: ${targetDir}`);
  }

  const detection = await detectApplyInput(targetDir, resolveTemplateDir());
  assertEsmProject(detection.targetPackageJson);

  const packageManager = await choosePackageManager(
    options.packageManager ?? detectPackageManager(targetDir),
    options.yes || options.packageManager !== undefined,
  );

  const plan = buildApplyPlan(targetDir, detection);
  // Warn before anything is written or installed: if install or the checks fail
  // later, only the error would be printed and this explanation would be lost.

  const shouldInstall = await resolveInstallDecision(
    options.install,
    options.yes,
    plan.requiresInstall,
    packageManager,
  );
  const shouldRunChecks = await resolveCheckDecision(options.runChecks, options.yes);
  // Warn before anything is written: if a later step fails, only the error would
  // be printed and this explanation would be lost.
  if (!shouldInstall && !options.dryRun) {
    for (const follower of plan.packageJsonPlan.summary.postInstallLockstep) {
      const leader = LOCKSTEP_DEV_DEPENDENCIES[follower] ?? follower;
      log.warn(
        `${follower} will not be added: it has to match the installed ${leader} and dependencies are not being installed. Install them and re-run strong-mode, or add ${follower} at your ${leader} version.`,
      );
    }
  }

  const summary: string[] = [
    `${formatSectionTitle("Target")} ${formatPath(targetDir)}`,
    "",
    ...summarizePlan(plan),
  ];

  const result = await executeApplyPlan(plan, {
    targetDir,
    packageManager,
    yes: options.yes,
    force: options.force,
    dryRun: options.dryRun,
    backup: options.backup,
    shouldInstall,
    shouldRunChecks,
  });

  return [
    ...summary,
    "",
    ...summarizeResult(result, options.dryRun, shouldInstall, shouldRunChecks),
  ];
};
