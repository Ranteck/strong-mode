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
  readonly overwrittenFiles: readonly string[];
  readonly skippedFiles: readonly string[];
  readonly packageJsonUpdated: boolean;
  readonly installRan: boolean;
  readonly checksRan: readonly string[];
}
