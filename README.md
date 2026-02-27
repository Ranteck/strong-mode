# zero-ts

`zero-ts` helps you create or upgrade TypeScript projects with strict, production-focused defaults.

## Start Here

If you want a new project:

```bash
npx create-zero-ts create my-app
```

If you want to upgrade an existing project:

```bash
npx create-zero-ts up
```

If you want a quick environment check:

```bash
npx create-zero-ts doctor
```

## Most Useful Commands

```bash
create-zero-ts create <name>     # scaffold a new project
create-zero-ts up                # apply template to current project
create-zero-ts apply             # same as up
create-zero-ts doctor            # check node/pm/write access/git state
```

`up`/`apply` are interactive by default.  
Use `-C <dir>` if you want to target a specific project folder.

## Common Examples

Interactive apply with backups (recommended):

```bash
npx create-zero-ts up -w -b -C ./my-project
```

Dry-run apply (no file writes):

```bash
npx create-zero-ts up -d -y -n -C ./my-project
```

Create without install:

```bash
npx create-zero-ts create my-app -y -n
```

## Short Flags

Common:

- `-y` = `--yes`
- `-p <pm>` = `--pm <pm>`
- `-C <dir>` = `--cwd <dir>` (apply/doctor)

`create`:

- `-d <dir>` = `--dir <dir>`
- `-i` = `--install`
- `-n` = `--no-install`
- `-g` = `--skip-git`

`up`/`apply`:

- `-w` = `--wizard`
- `-d` = `--dry-run`
- `-b` = `--backup`
- `-f` = `--force`
- `-c` = `--check`
- `-k` = `--no-check`
- `-i` = `--install`
- `-n` = `--no-install`

## What Happens During `up`

The wizard shows a plan, then asks how to resolve conflicts:

- `Skip`: keep your file
- `Overwrite`: use template file
- `View diff`: inspect before deciding
- `Merge`: available for supported file types

Current merge support:

- `*.json`, `*.jsonc`: deep merge (keep existing values, add missing template keys)
- `.gitignore`, `.npmrc`, `.npmignore`, `.dockerignore`: line union
- `lefthook.yml`: merges hook commands and missing hook settings; on command collisions it keeps your value and appends YAML comment conflict markers for review

## What zero-ts Adds

- Strict TypeScript defaults
- ESLint flat config with strict type safety rules
- `zod`-based env validation pattern in `src/env.ts`
- Quality scripts: `check`, `quality`, `zero:check`, `zero:quality`
- Optional `.github/workflows/quality.yml`
- `.zero-ts.json` manifest

## For This Repository (Development)

Package built here: `create-zero-ts`  
Binary names: `create-zero-ts`, `zero-ts`

Local dev:

```bash
npm install
npm run sync:template
npm run check
npm run build
```

Local smoke test without publishing:

```bash
node packages/create-zero-ts/dist/cli.js create demo-app -y -n
node packages/create-zero-ts/dist/cli.js up -d -y -n -C ./demo-app
node packages/create-zero-ts/dist/cli.js doctor -C .
```

Full release gate:

```bash
npm run release:check
```
