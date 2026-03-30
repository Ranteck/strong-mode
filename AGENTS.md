# Repository Guidelines

## Project Structure & Module Organization

This repository is a workspace for a TypeScript strong-mode toolkit.

- `packages/scaffold-ultra/template/`: source-of-truth template files applied to target projects.
- `packages/strong-mode/`: CLI package published as `strong-mode` (`npx strong-mode`).
- `scripts/sync-template.mjs`: syncs the scaffold into `packages/strong-mode/template` before build/publish.

Keep generated-project rules inside `packages/scaffold-ultra/template`, not directly in the CLI logic.

## Build, Test, and Development Commands

- `npm install`: install workspace dependencies.
- `npm run sync:template`: copy scaffold files into the CLI package.
- `npm run build`: build `strong-mode` with `tsup`.
- `npm run typecheck`: run strict TypeScript checks for the CLI package.
- `npm run lint`: run ESLint on CLI source.
- `npm run test`: run CLI unit tests (Vitest).
- `npm run check`: run typecheck + lint + tests.

Local smoke test:

- `node packages/strong-mode/dist/cli.js --dry-run --yes`

## Coding Style & Naming Conventions

- TypeScript ESM everywhere (`"type": "module"`).
- Strict typing required; avoid `any`.
- Keep CLI code in `packages/strong-mode/src` with small focused modules (`args.ts`, `template.ts`, etc.).
- Use clear, imperative script names (`sync:template`, `deps:cycles`).

## Testing Guidelines

- Framework: Vitest (`packages/strong-mode/vitest.config.ts`).
- Test files: `*.test.ts` alongside source in `packages/strong-mode/src/`.
- Add tests for argument parsing, path handling, and template rendering helpers when behavior changes.

## Commit & Pull Request Guidelines

No mature commit convention exists yet; use Conventional Commits (`feat:`, `fix:`, `chore:`) with imperative summaries.

PRs should include:

- What changed (`scaffold`, `CLI`, or both).
- Why it changed (user-facing impact).
- Validation evidence (`npm run check`, plus one local scaffold run).

## Reference Snippets

For reusable policy snippets and copy-ready sections to adapt into project instructions, see `AGENTS.reference.md`.

`AGENTS.md` remains the active repository-specific instruction file. `AGENTS.reference.md` is reference material and does not apply unless copied or injected into the effective instructions.
