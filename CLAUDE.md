# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`zero-ts` is an ultra-strict TypeScript project generator (CLI tool) focused on anti-slop defaults for AI-assisted coding. It generates new projects with strict TypeScript configurations and provides an "apply" command to retrofit existing projects with the same quality standards.

Published as `create-zero-ts` on npm, invoked via `npm create zero-ts@latest`.

## Repository Structure

This is an npm workspace monorepo with two key packages:

- **`packages/scaffold-ultra/template/`**: Source of truth for all scaffold files (tsconfig, eslint, vitest, etc.)
- **`packages/create-zero-ts/`**: Published CLI package that contains the generator logic

**Critical sync mechanism**: `scripts/sync-template.mjs` copies `scaffold-ultra/template/` → `create-zero-ts/template/` for npm publishing. This runs automatically before build/pack via prebuild/prepack hooks.

## Common Commands

### Development workflow
```bash
npm install                     # Install all workspace dependencies
npm run sync:template           # Manually sync template (auto-runs before build)
npm run check                   # Run typecheck, lint, test in create-zero-ts
npm run build                   # Build the CLI package
```

### Testing locally without publishing
```bash
npm run build -w create-zero-ts
node packages/create-zero-ts/dist/cli.js demo-app --yes --no-install
node packages/create-zero-ts/dist/cli.js apply --dry-run --yes
```

### Running a single test file
```bash
npx vitest run src/args.test.ts -w create-zero-ts
npx vitest run src/apply/patchers.test.ts -w create-zero-ts
```

### Generated project commands
Projects created by zero-ts have these npm scripts:
- `check`: Fast gate (typecheck + lint + format:check + dead-code)
- `quality`: Full gate (check + test:coverage + deps:graph + deps:cycles + audit)
- `test`: Run tests with vitest
- `build`: Compile TypeScript
- `dead-code`: Find unused exports with knip
- `deps:graph`: Validate dependencies with dependency-cruiser
- `deps:cycles`: Detect circular dependencies with madge

## Architecture

### CLI Entry Points

**`src/cli.ts`**: Main entry point. Parses args (`src/args.ts`) and routes to:
- **`src/create-command.ts`**: Creates new project from scratch (copies template, initializes git, optionally installs)
- **`src/apply-command.ts`**: Applies template to existing project (detects conflicts, patches package.json, creates backups)

### Argument Parsing (`src/args.ts`)

`parseCliArgs(argv)` returns a discriminated union (`CreateCliOptions | ApplyCliOptions`) based on `command` field. First token "apply" or "--apply" routes to apply parsing; everything else is the create command. Both parsers support `--flag value` and `--flag=value` formats and reject unknown flags.

### Template System

**`src/template.ts`**: Core template operations. Files use `__PROJECT_NAME__` as a token placeholder, replaced with the actual project name during copy/detect. Template validation uses `sanitizePackageName()` and `assertValidPackageName()`.

**9 managed template files** (defined in `src/apply/constants.ts`): tsconfig.json, eslint.config.mjs, prettier.config.mjs, vitest.config.ts, knip.config.ts, depcruise.config.cjs, lefthook.yml, .gitignore, src/env.ts.

### Apply Command Pipeline

The apply command (for existing projects) uses a detect → plan → execute pipeline:

1. **`src/apply/detect.ts`**: Reads target project state — existing package.json, which managed files already exist, and their current content
2. **`src/apply/plan.ts`**: Splits managed files into `filesToCreate` (new) and `conflictingFiles` (existing), builds package.json merge plan
3. **`src/apply/patchers.ts`**: Generates package.json merge plan — adds template dependencies/scripts without removing existing ones. Special handling for `prepare` script (appends `lefthook install` if missing)
4. **`src/apply/execute.ts`**: Executes the plan with dry-run, backup (`{file}.zero-ts-backup.{ISO-timestamp}`), and force options. Prompts for conflict resolution (overwrite/skip/diff preview)

### Package Manager Detection (`src/package-manager.ts`)

Detection order: lockfile presence (`package-lock.json` → npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun) → `npm_config_user_agent` env var → defaults to npm.

### Build Tooling

**tsup** bundles `src/cli.ts` → `dist/cli.js` as ESM with `#!/usr/bin/env node` shebang, targeting Node 22. Published package includes `dist/` and `template/` directories with two bin entries: `create-zero-ts` and `zero-ts`.

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
- **CLI flags**: `--yes`, `--dry-run`, `--force`, `--backup`, `--no-install`, `--skip-git`, `--pm=<manager>`, `--cwd=<path>`, `--dir=<path>`
- **Template sync**: MUST run `sync:template` before building to ensure CLI bundles latest scaffold
- **Node requirement**: Requires Node.js >= 22
- **ESLint config** (CLI project itself): enforces `explicit-function-return-type`, `no-floating-promises`, `consistent-type-imports`; relaxes return type requirement in test files

## Testing

- Uses Vitest with globals mode (`describe`, `it`, `expect` available without imports)
- Test files: `*.test.ts` colocated in `packages/create-zero-ts/src/`
- Key test suites: `args.test.ts` (flag parsing), `template.test.ts` (name validation), `apply/patchers.test.ts` (package.json merge), `apply/plan.test.ts` (file splitting)

## Important Constraints

- **Never modify** `packages/scaffold-ultra/template/` without running `npm run sync:template`
- **Package.json patching** must preserve user's existing fields (see `patchers.ts`)
- **ESLint config** enforces kebab-case filenames, but allows `.test.ts` and config files
- **All TypeScript code** must have explicit return types and pass strict type checking
