# Repository Guidelines

## Project Structure & Module Organization
This repository is an npm workspace monorepo:
- `packages/create-zero-ts`: published CLI (`zero-ts` / `create-zero-ts`) source in `src/`, tests in `src/**/*.test.ts`, build output in `dist/`.
- `packages/scaffold-ultra/template`: source-of-truth scaffold template files.
- `packages/create-zero-ts/template`: synced copy of the scaffold used for publishing.
- `scripts/sync-template.mjs`: copies `scaffold-ultra/template` into `create-zero-ts/template`.

Rule: edit template files in `packages/scaffold-ultra/template` first, then run sync.

## Build, Test, and Development Commands
Use Node `>=22` and npm workspaces.
- `npm install`: install workspace dependencies.
- `npm run sync:template`: refresh `packages/create-zero-ts/template` from scaffold source.
- `npm run build`: build CLI package with `tsup`.
- `npm run typecheck`: run `tsc --noEmit` in `create-zero-ts`.
- `npm run lint`: run ESLint with zero warnings allowed.
- `npm run test`: run Vitest tests.
- `npm run check`: run typecheck + lint + test.

Useful local CLI smoke tests:
- `node packages/create-zero-ts/dist/cli.js demo-app --yes --no-install`
- `node packages/create-zero-ts/dist/cli.js apply --dry-run --yes`

## Coding Style & Naming Conventions
TypeScript is strict and ESM-first (`module: NodeNext`).
- Prettier settings (template): 2 spaces, semicolons, double quotes, trailing commas, `printWidth: 88`.
- ESLint uses `typescript-eslint` strict + stylistic configs.
- Keep explicit return types on functions (`@typescript-eslint/explicit-function-return-type`).
- Prefer consistent type imports and avoid floating promises.
- File names are kebab-case (for example `create-command.ts`, `package-manager.ts`).

## Testing Guidelines
Framework: Vitest (`packages/create-zero-ts/vitest.config.ts`).
- Test files must be named `*.test.ts` under `src/`.
- Run `npm run test` for CI-equivalent execution.
- For generated projects, quality gates include `test:coverage` via `zero:quality`.

## Commit & Pull Request Guidelines
Follow Conventional Commit style seen in history:
- `feat: ...`
- `refactor: ...`
- `docs: ...`

PRs should include:
- Clear summary of behavior changes and affected package(s).
- Linked issue/context when applicable.
- Command results used for validation (at minimum `npm run check`; include CLI dry-run output for generator changes).
