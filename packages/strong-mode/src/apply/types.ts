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
  // Lockstep followers not added because the project's leader could not be matched
  // (for example `catalog:` vitest with nothing installed); a re-run adds them.
  readonly deferredLockstep: readonly string[];
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
  readonly packageJsonUpdated: boolean;
  readonly installRan: boolean;
  readonly checksRan: readonly string[];
}

// A lockstep leader found in node_modules. `inProject` is false when it was only
// found in a parent directory (a workspace root), whose install may not match the
// package's own resolution of a non-semver specifier such as `catalog:`.
export interface InstalledVersion {
  readonly version: string;
  readonly inProject: boolean;
}
