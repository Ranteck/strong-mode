export interface PackageJsonLike {
  name?: string;
  version?: string;
  type?: "module" | "commonjs";
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  [key: string]: unknown;
}

export interface ManagedFile {
  readonly relativePath: string;
  readonly sourceTemplatePath: string;
  readonly content: string;
  readonly exists: boolean;
}

export interface PackageJsonChangeSummary {
  readonly addedScripts: readonly string[];
  readonly updatedScripts: readonly string[];
  readonly addedDependencies: readonly string[];
  readonly addedDevDependencies: readonly string[];
  readonly updatedPrepareScript: boolean;
  // Lockstep followers left out of package.json because the project declares their
  // leader: they are added after install, pinned to the leader version the package
  // manager actually resolved.
  readonly postInstallLockstep: readonly string[];
  readonly changed: boolean;
}

export interface PackageJsonPlan {
  readonly path: string;
  readonly exists: boolean;
  readonly current: PackageJsonLike | undefined;
  readonly next: PackageJsonLike;
  readonly summary: PackageJsonChangeSummary;
}

export interface ApplyPlan {
  readonly projectName: string;
  readonly filesToCreate: readonly ManagedFile[];
  readonly conflictingFiles: readonly ManagedFile[];
  readonly packageJsonPlan: PackageJsonPlan;
  readonly requiresInstall: boolean;
}

export interface ApplySummary {
  readonly createdFiles: readonly string[];
  readonly conflictedFiles: readonly string[];
  readonly mergedFiles: readonly string[];
  readonly overwrittenFiles: readonly string[];
  readonly skippedFiles: readonly string[];
  // Lockstep followers added after install at the installed leader version;
  // `verified` means both installed versions were read back and match.
  readonly alignedLockstep: readonly AlignedLockstep[];
  // Followers whose installed version differs from the leader after adding them
  // (for example because of overrides or resolutions).
  readonly mismatchedLockstep: readonly MismatchedLockstep[];
  // Lockstep followers not added because install did not run or the installed
  // leader could not be resolved.
  readonly deferredLockstep: readonly string[];
  // Dependent files held back because their dependency was left in conflict.
  readonly deferredFiles: readonly string[];
  readonly packageJsonUpdated: boolean;
  readonly installRan: boolean;
  readonly checksRan: readonly string[];
}

export interface AlignedLockstep {
  readonly name: string;
  readonly version: string;
  readonly verified: boolean;
}

export interface MismatchedLockstep {
  readonly name: string;
  readonly leaderVersion: string;
  readonly followerVersion: string;
}
