# Repository Guidelines

## Project Structure & Module Organization

This repository is a workspace for a TypeScript anti-slop toolkit.

- `packages/scaffold-ultra/template/`: source-of-truth template files applied to target projects.
- `packages/slop-free/`: CLI package published as `slop-free` (`npx slop-free`).
- `scripts/sync-template.mjs`: syncs the scaffold into `packages/slop-free/template` before build/publish.

Keep generated-project rules inside `packages/scaffold-ultra/template`, not directly in the CLI logic.

## Build, Test, and Development Commands

- `npm install`: install workspace dependencies.
- `npm run sync:template`: copy scaffold files into the CLI package.
- `npm run build`: build `slop-free` with `tsup`.
- `npm run typecheck`: run strict TypeScript checks for the CLI package.
- `npm run lint`: run ESLint on CLI source.
- `npm run test`: run CLI unit tests (Vitest).
- `npm run check`: run typecheck + lint + tests.

Local smoke test:

- `node packages/slop-free/dist/cli.js --dry-run --yes`

## Coding Style & Naming Conventions

- TypeScript ESM everywhere (`"type": "module"`).
- Strict typing required; avoid `any`.
- Keep CLI code in `packages/slop-free/src` with small focused modules (`args.ts`, `template.ts`, etc.).
- Use clear, imperative script names (`sync:template`, `deps:cycles`).

## Testing Guidelines

- Framework: Vitest (`packages/slop-free/vitest.config.ts`).
- Test files: `*.test.ts` alongside source in `packages/slop-free/src/`.
- Add tests for argument parsing, path handling, and template rendering helpers when behavior changes.

## Commit & Pull Request Guidelines

No mature commit convention exists yet; use Conventional Commits (`feat:`, `fix:`, `chore:`) with imperative summaries.

PRs should include:

- What changed (`scaffold`, `CLI`, or both).
- Why it changed (user-facing impact).
- Validation evidence (`npm run check`, plus one local scaffold run).
