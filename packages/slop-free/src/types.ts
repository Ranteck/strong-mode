export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;

export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

interface BaseCliOptions {
  readonly packageManager?: PackageManager;
  /** Tristate: undefined = prompt/yes-default, true = always, false = never */
  readonly install?: boolean;
  readonly yes: boolean;
}

/**
 * Options for the `apply` command.
 *
 * `install` and `runChecks` follow a tristate convention:
 *   - `undefined` = defer to interactive prompt (or yes-flag default)
 *   - `true`      = explicit user override: always run
 *   - `false`     = explicit user override: never run
 */
export interface ApplyCliOptions extends BaseCliOptions {
  readonly command: "apply";
  readonly cwd?: string;
  readonly dryRun: boolean;
  /** Tristate: undefined = prompt/yes-default, true = always, false = never */
  readonly runChecks?: boolean;
  readonly backup: boolean;
  readonly force: boolean;
}
