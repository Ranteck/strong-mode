export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;

export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export type CliCommand = "create" | "apply" | "doctor";

interface BaseCliOptions {
  readonly command: CliCommand;
  readonly packageManager?: PackageManager | undefined;
  readonly install?: boolean | undefined;
  readonly yes: boolean;
}

export interface CreateCliOptions extends BaseCliOptions {
  readonly command: "create";
  readonly projectName?: string | undefined;
  readonly targetDir?: string | undefined;
  readonly skipGit: boolean;
}

export interface ApplyCliOptions extends BaseCliOptions {
  readonly command: "apply";
  readonly cwd?: string | undefined;
  readonly wizard: boolean;
  readonly dryRun: boolean;
  readonly runChecks?: boolean | undefined;
  readonly backup: boolean;
  readonly force: boolean;
}

export interface DoctorCliOptions {
  readonly command: "doctor";
  readonly cwd?: string | undefined;
  readonly packageManager?: PackageManager | undefined;
}

export type CliOptions = CreateCliOptions | ApplyCliOptions | DoctorCliOptions;
