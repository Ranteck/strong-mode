import path from "node:path";
import { REPLACED_DEV_DEPENDENCIES } from "./constants.js";
import { buildPackageJsonPlan, dropReplacedDependencies } from "./patchers.js";
import type { ApplyPlan } from "./types.js";
import type { ApplyDetection } from "./detect.js";

export const buildApplyPlan = (
  targetDir: string,
  detection: ApplyDetection,
): ApplyPlan => {
  const filesToCreate = detection.managedFiles.filter(
    (managedFile) => !managedFile.exists,
  );
  const conflictingFiles = detection.managedFiles.filter(
    (managedFile) => managedFile.exists,
  );

  const packageJsonPlan = buildPackageJsonPlan(
    path.join(targetDir, "package.json"),
    detection.targetPackageJson,
    detection.templatePackageJson,
    detection.projectName,
  );

  // Lockstep followers are added after install, so they require one too. So does a
  // replaced package the apply step may remove (decided later, once its config file
  // is known to be the template's): without an install the lockfile would go stale.
  const removableReplaced = dropReplacedDependencies(
    packageJsonPlan.next,
    new Set(
      Object.values(REPLACED_DEV_DEPENDENCIES).map(({ configFile }) => configFile),
    ),
  ).dropped;
  const requiresInstall =
    packageJsonPlan.summary.addedDependencies.length > 0 ||
    packageJsonPlan.summary.addedDevDependencies.length > 0 ||
    packageJsonPlan.summary.postInstallLockstep.length > 0 ||
    removableReplaced.length > 0;

  return {
    projectName: detection.projectName,
    filesToCreate,
    conflictingFiles,
    packageJsonPlan,
    requiresInstall,
  };
};
