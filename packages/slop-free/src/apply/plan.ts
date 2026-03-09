import path from "node:path";
import { buildPackageJsonPlan } from "./patchers.js";
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

  const requiresInstall =
    packageJsonPlan.summary.addedDependencies.length > 0 ||
    packageJsonPlan.summary.addedDevDependencies.length > 0;

  return {
    projectName: detection.projectName,
    filesToCreate,
    conflictingFiles,
    packageJsonPlan,
    requiresInstall,
  };
};
