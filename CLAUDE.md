# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`slop-free` is an ultra-strict TypeScript CLI tool focused on anti-slop defaults for AI-assisted coding. It retrofits existing projects with strict TypeScript configurations and quality gates via the `apply` command.

Published as `slop-free` on npm, invoked via `npx slop-free`.

## Repository Structure

This is an npm workspace monorepo with two key packages:

- **`packages/scaffold-ultra/template/`**: Source of truth for all scaffold files (tsconfig, eslint, vitest, etc.)
- **`packages/slop-free/`**: Published CLI package that contains the generator logic

**Critical sync mechanism**: `scripts/sync-template.mjs` copies `scaffold-ultra/template/` → `slop-free/template/` for npm publishing. This runs automatically before build/pack via prebuild/prepack hooks.

## Common Commands

### Development workflow
```bash
npm install                     # Install all workspace dependencies
npm run sync:template           # Manually sync template (auto-runs before build)
npm run check                   # Run typecheck, lint, test in slop-free
npm run build                   # Build the CLI package
```

### Testing locally without publishing
```bash
npm run build -w slop-free
node packages/slop-free/dist/cli.js --dry-run --yes
```

### Running a single test file
```bash
npx vitest run src/args.test.ts -w slop-free
npx vitest run src/apply/patchers.test.ts -w slop-free
```

### Generated project commands
Scripts added to target projects by `slop-free`:
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

**9 managed template files** (defined in `src/apply/constants.ts`): tsconfig.json, eslint.config.mjs, prettier.config.mjs, vitest.config.ts, knip.config.ts, depcruise.config.cjs, lefthook.yml, .gitignore, src/env.ts.

### Apply Command Pipeline

The apply command (for existing projects) uses a detect → plan → execute pipeline:

1. **`src/apply/detect.ts`**: Reads target project state — existing package.json, which managed files already exist, and their current content
2. **`src/apply/plan.ts`**: Splits managed files into `filesToCreate` (new) and `conflictingFiles` (existing), builds package.json merge plan
3. **`src/apply/patchers.ts`**: Generates package.json merge plan — adds template dependencies/scripts without removing existing ones. Special handling for `prepare` script (appends `lefthook install` if missing)
4. **`src/apply/execute.ts`**: Executes the plan with dry-run, backup (`{file}.slop-free-backup.{ISO-timestamp}`), and force options. Prompts for conflict resolution (overwrite/skip/diff preview)

### Package Manager Detection (`src/package-manager.ts`)

Detection order: lockfile presence (`package-lock.json` → npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun) → `npm_config_user_agent` env var → defaults to npm.

### Build Tooling

**tsup** bundles `src/cli.ts` → `dist/cli.js` as ESM with `#!/usr/bin/env node` shebang, targeting Node 22. Published package includes `dist/` and `template/` directories with one bin entry: `slop-free`.

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

- **Cross-platform**: Uses `cross-spawn` for command execution with shell enabled on Windows
- **Interactive prompts**: Uses `@clack/prompts` with `exitOnCancel` wrapper (`src/ui.ts`)
- **CLI flags**: `--yes`, `--dry-run`, `--force`, `--backup`, `--install/--no-install`, `--check/--no-check`, `--pm=<manager>`, `--cwd=<path>`
- **Template sync**: MUST run `sync:template` before building to ensure CLI bundles latest scaffold
- **Node requirement**: Requires Node.js >= 22
- **ESLint config** (CLI project itself): enforces `explicit-function-return-type`, `no-floating-promises`, `consistent-type-imports`; relaxes return type requirement in test files

## Testing

- Uses Vitest with globals mode (`describe`, `it`, `expect` available without imports)
- Test files: `*.test.ts` colocated in `packages/slop-free/src/`
- Key test suites: `args.test.ts` (flag parsing), `template.test.ts` (name validation), `apply/patchers.test.ts` (package.json merge), `apply/plan.test.ts` (file splitting)

## Important Constraints

- **Never modify** `packages/scaffold-ultra/template/` without running `npm run sync:template`
- **Package.json patching** must preserve user's existing fields (see `patchers.ts`)
- **ESLint config** enforces kebab-case filenames, but allows `.test.ts` and config files
- **All TypeScript code** must have explicit return types and pass strict type checking
