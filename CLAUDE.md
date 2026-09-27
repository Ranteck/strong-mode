# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`strong-mode` is an ultra-strict TypeScript CLI tool focused on strong-mode defaults for AI-assisted coding. It retrofits existing projects with strict TypeScript configurations and quality gates via the `apply` command.

Published as `strong-mode` on npm, invoked via `npx strong-mode`.

## Repository Structure

This is an npm workspace monorepo with two key packages:

- **`packages/scaffold-ultra/template/`**: Source of truth for all scaffold files (tsconfig, eslint, vitest, etc.)
- **`packages/strong-mode/`**: Published CLI package that contains the generator logic

**Critical sync mechanism**: `scripts/sync-template.mjs` copies `scaffold-ultra/template/` → `strong-mode/template/` for npm publishing. This runs automatically before build/pack via prebuild/prepack hooks.

## Common Commands

### Development workflow

```bash
npm install                     # Install all workspace dependencies
npm run sync:template           # Manually sync template (auto-runs before build)
npm run check                   # Run typecheck, lint, test in strong-mode
npm run build                   # Build the CLI package
```

### Testing locally without publishing

```bash
npm run build -w strong-mode
node packages/strong-mode/dist/cli.js --dry-run --yes
```

### Running a single test file

```bash
npm run test -w strong-mode -- src/args.test.ts
npm run test -w strong-mode -- src/apply/patchers.test.ts
```

### Generated project commands

Scripts added to target projects by `strong-mode`:

- `check`: Fast gate (typecheck + lint + format:check + dead-code)
- `quality`: Full gate (check + test:coverage + deps:graph + deps:cycles + audit)
- `test`: Run tests with vitest
- `build`: Compile TypeScript
- `dead-code`: Find unused exports with knip
- `deps:graph`: Validate dependencies with dependency-cruiser
- `deps:cycles`: Detect circular dependencies with madge

## Architecture

### CLI Entry Points

**`src/cli.ts`**: Main entry point. Calls `parseCliArgs` then `runApplyCommand`.

**`src/apply-command.ts`**: Applies template to existing project — detects conflicts, patches package.json, creates backups.

### Argument Parsing (`src/args.ts`)

`parseCliArgs(argv)` returns `ApplyCliOptions`. Supports `--flag value` and `--flag=value` formats. Rejects unknown flags and positional arguments.

### Template System

**`src/template.ts`**: Core template operations. Files use `__PROJECT_NAME__` as a token placeholder, replaced with the actual project name during copy/detect. Template validation uses `sanitizePackageName()` and `assertValidPackageName()`.

**13 managed template files** (defined in `src/apply/constants.ts`): tsconfig.json, tsconfig.eslint.json (type-aware lint scope: every `.ts/.tsx/.mts/.cts` file, dot-directories included; `eslint.config.mjs` also skips whatever `.gitignore` ignores via `@eslint/compat` `includeIgnoreFile` and lints plain JS without type information), eslint.config.mjs, prettier.config.mjs, vitest.config.ts, knip.config.ts, depcruise.config.cjs, lefthook.yml, `scripts/run-package-manager.sh`, `scripts/prepare-hooks.mjs`, .gitignore, src/env.ts, tests/env.test.ts (keeps the managed env.ts covered; `MANAGED_FILE_DEPENDENCIES` makes `execute.ts` write it last and only when `src/env.ts` ends up with the template content). The template is ESM-only: `src/apply/module-system.ts` (`assertEsmProject`) rejects `"type": "commonjs"` projects in `runApplyCommand` right after detection, before any prompt or write. Known gaps are listed in the README "Roadmap / Known limitations" section.

### Apply Command Pipeline

The apply command (for existing projects) uses a detect → plan → execute pipeline:

1. **`src/apply/detect.ts`**: Reads target project state — existing package.json, which managed files already exist, and their current content
2. **`src/apply/plan.ts`**: Splits managed files into `filesToCreate` (new) and `conflictingFiles` (existing), builds package.json merge plan
3. **`src/apply/patchers.ts`**: Generates package.json merge plan — adds template dependencies/scripts without removing existing ones. Special handling for `prepare` script (appends `node ./scripts/prepare-hooks.mjs` if missing). Placeholder scripts from `npm init` (`PLACEHOLDER_SCRIPTS`, e.g. `test: echo "Error: no test specified" && exit 1`) are replaced by the template script. Lockstep packages (`LOCKSTEP_DEV_DEPENDENCIES`, e.g. `@vitest/coverage-v8` → `vitest`) peer-depend on the exact same version: when the project already declares the leader, the follower is left out of `next` and listed in `summary.postInstallLockstep` for `execute.ts` to add after install. Template devDependencies skip packages the project declares in `dependencies`. `dropReplacedDependencies` removes packages the template replaced (`REPLACED_DEV_DEPENDENCIES`, e.g. `eslint-plugin-eslint-comments`) only when their config file ends up with the template content. `summary.setModuleType` flags a package.json without `"type"` that is switched to ESM (warned before executing)
4. **`src/apply/execute.ts`**: Executes the plan with dry-run, backup (`{file}.strong-mode-backup.{ISO-timestamp}`), and force options. Per-file conflict resolution comes from `src/apply/prompts.ts`: merge, Git-style conflict markers, overwrite, skip, or diff preview. `--force` always overwrites; `--yes` picks a default per file type — `package.json` → overwrite with the merge plan, `tsconfig.json`/`tsconfig.eslint.json`/`.gitignore` → structural merge via `src/apply/merge.ts` (falls back to conflict markers), everything else → conflict markers. Install and post-apply checks (`src/apply/checks.ts`: typecheck → lint → test) are skipped when any file was left with conflict markers. After a successful install, each `postInstallLockstep` follower is added with the package manager's exact dev-dependency command (`addDevDependencyCommand` in `src/package-manager.ts`, with workspace-root flags) at the leader version resolved from the project (Node resolution, or `yarn node -p` for Yarn PnP); both versions are then re-resolved into `alignedLockstep` or `mismatchedLockstep`, and without an install the follower is reported in `deferredLockstep`. Managed files whose `MANAGED_FILE_DEPENDENCIES` dependency is still in conflict are reported in `deferredFiles`

### Package Manager Detection (`src/package-manager.ts`)

Detection order: lockfile presence (`package-lock.json` → npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun) → `npm_config_user_agent` env var → defaults to npm.

### Build Tooling

**tsup** bundles `src/cli.ts` → `dist/cli.js` as ESM with `#!/usr/bin/env node` shebang, targeting Node 22. Published package includes `dist/` and `template/` directories with one bin entry: `strong-mode`.

## Strict TypeScript Philosophy

Generated projects enforce extreme type safety:

**tsconfig.json flags**: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `skipLibCheck: false`

**ESLint anti-escape rules** (see `packages/scaffold-ultra/template/eslint.config.mjs`):

- `no-explicit-any`, `no-unsafe-*` as errors
- `ban-ts-comment` with 10-char minimum descriptions
- No chained assertions (`value as unknown as T`)
- `process.env` access restricted to `src/env.ts`
- Complexity limits: max 10 cyclomatic, max 3 depth, max 4 params

**Runtime validation pattern**: All environment variables must be validated through `src/env.ts` using Zod with `.safeParse()` on unknown input.

## Key Implementation Details

- **Cross-platform**: Uses `cross-spawn` for command execution; `runCommand` enables the shell on Windows, while `runCommandCapture` (stdout queries such as `yarn node -p`) runs without it so cross-spawn escapes the quoted arguments for `cmd.exe`
- **Interactive prompts**: Uses `@clack/prompts` with `exitOnCancel` wrapper (`src/ui.ts`)
- **CLI flags**: `--yes`, `--dry-run`, `--force`, `--backup`, `--install/--no-install`, `--check/--no-check`, `--pm=<manager>`, `--cwd=<path>`
- **Node requirement**: Requires Node.js >= 22
- **ESLint config** (CLI project itself): enforces `explicit-function-return-type`, `no-floating-promises`, `consistent-type-imports`; relaxes return type requirement in test files

## Testing

- Uses Vitest with globals mode (`describe`, `it`, `expect` available without imports)
- Test files: `*.test.ts` colocated in `packages/strong-mode/src/`
- Key test suites: `args.test.ts` (flag parsing), `template.test.ts` (name validation), `apply/patchers.test.ts` (package.json merge), `apply/plan.test.ts` (file splitting)

## Definition of Done

- `npm run check` passes.
- If you changed `packages/strong-mode/src/` or the template: `npm run build -w strong-mode && node packages/strong-mode/dist/cli.js --dry-run --yes`.
- If you changed `packages/scaffold-ultra/template/`: run `npm run sync:template` and commit `packages/strong-mode/template/` too (it is tracked in git).
- Commits use Conventional Commits (`feat:`, `fix:`, `chore:`). Keep generated-project rules in the template, not in CLI logic. PR requirements live in `AGENTS.md`.

## Important Constraints

- After editing `packages/scaffold-ultra/template/`, run `npm run sync:template`. build/pack also run it, but the synced copy in `packages/strong-mode/template/` is committed, so commits need it too
- **Package.json patching** must preserve user's existing fields (see `patchers.ts`)
- **ESLint config** enforces kebab-case filenames, but allows `.test.ts` and config files
- **All TypeScript code** must have explicit return types and pass strict type checking
