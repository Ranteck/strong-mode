import { confirm, select } from "@clack/prompts";
import { stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { detectApplyInput } from "./apply/detect.js";
import { executeApplyPlan } from "./apply/execute.js";
import { buildApplyPlan } from "./apply/plan.js";
import { detectPackageManager, packageManagerLabel } from "./package-manager.js";
import { resolveTemplateDir } from "./template.js";
import { PACKAGE_MANAGERS, type ApplyCliOptions, type PackageManager } from "./types.js";
import { exitOnCancel } from "./ui.js";

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
      label: packageManagerLabel(packageManager),
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

const summarizePlan = (plan: ReturnType<typeof buildApplyPlan>): readonly string[] => {
  const summary = [
    `Project name: ${plan.projectName}`,
    `Files to create: ${String(plan.filesToCreate.length)}`,
    `Files with conflicts: ${String(plan.conflictingFiles.length)}`,
    `Package.json changed: ${plan.packageJsonPlan.summary.changed ? "yes" : "no"}`,
    `Dependencies to add: ${String(plan.packageJsonPlan.summary.addedDependencies.length)}`,
    `Dev dependencies to add: ${String(plan.packageJsonPlan.summary.addedDevDependencies.length)}`,
  ];

  return summary;
};

const summarizeResult = (
  result: Awaited<ReturnType<typeof executeApplyPlan>>,
  dryRun: boolean,
  shouldInstall: boolean,
  shouldRunChecks: boolean,
): readonly string[] => [
  `Created files: ${String(result.createdFiles.length)}`,
  `Overwritten files: ${String(result.overwrittenFiles.length)}`,
  `Skipped files: ${String(result.skippedFiles.length)}`,
  `package.json updated: ${result.packageJsonUpdated ? "yes" : "no"}`,
  dryRun
    ? `Install: ${shouldInstall ? "would run" : "skipped"}`
    : `Install ran: ${result.installRan ? "yes" : "no"}`,
  dryRun
    ? `Checks: ${shouldRunChecks ? "would run" : "skipped"}`
    : `Checks ran: ${result.checksRan.length > 0 ? result.checksRan.join(", ") : "none"}`,
];

export const runApplyCommand = async (options: ApplyCliOptions): Promise<readonly string[]> => {
  const targetDir = path.resolve(process.cwd(), options.cwd ?? ".");
  const targetStat = await stat(targetDir).catch((): undefined => undefined);
  if (targetStat === undefined) {
    throw new Error(`Target directory does not exist: ${targetDir}`);
  }
  if (!targetStat.isDirectory()) {
    throw new Error(`Target path is not a directory: ${targetDir}`);
  }

  const packageManager = await choosePackageManager(
    options.packageManager ?? detectPackageManager(targetDir),
    options.yes || options.packageManager !== undefined,
  );

  const detection = await detectApplyInput(targetDir, resolveTemplateDir());
  const plan = buildApplyPlan(targetDir, detection);

  const shouldInstall = await resolveInstallDecision(
    options.install,
    options.yes,
    plan.requiresInstall,
    packageManager,
  );
  const shouldRunChecks = await resolveCheckDecision(options.runChecks, options.yes);

  const summary: string[] = [
    `Applying anti-slop template to ${targetDir}`,
    "",
    "Plan summary:",
    ...summarizePlan(plan).map((line) => `  - ${line}`),
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
    options.dryRun ? "Dry-run result:" : "Apply result:",
    ...summarizeResult(result, options.dryRun, shouldInstall, shouldRunChecks).map((line) => `  - ${line}`),
  ];
};
