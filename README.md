# strong-mode

Safe vibe coding for TypeScript.

```bash
npx strong-mode
```

`strong-mode` hardens existing TypeScript projects with strict defaults, sharper lint rules, and quality guardrails built for AI-assisted coding. It upgrades the tooling around your codebase without rewriting the app itself.

> **Requires an ES module project** (`"type": "module"` in `package.json`). CommonJS projects are rejected before anything is written; see [Roadmap / Known limitations](#roadmap--known-limitations).

## What it installs

`strong-mode` layers a strict baseline onto an existing repository. You keep your app code; it adds the rails around it.

**TypeScript** (`tsconfig.json`):

- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`
- `skipLibCheck: false`

**ESLint** (`eslint.config.mjs`):

- No `any`, no `ts-expect-error` without a 10-char description, no chained assertions (`as unknown as T`)
- `process.env` access restricted to `src/env.ts`
- Complexity limits: cyclomatic ≤ 10, depth ≤ 3, params ≤ 4
- Type-aware linting of every TypeScript file in the project (any framework layout) through `tsconfig.eslint.json`

**Runtime validation** (`src/env.ts`, tested by `tests/env.test.ts` — added only when the project uses the template's `src/env.ts`):

- Zod-based env validation template — all `process.env` access goes through here; invalid values throw at startup

**Quality gates** (npm scripts):

- `check`: typecheck + lint + format check + dead code (fast, pre-commit)
- `quality`: check + tests + coverage + dep graph + dep cycles + audit (full)
- `test`: runs Vitest with coverage thresholds (90% lines/functions/statements, 85% branches) on every run

**Tooling configs**: Prettier, Vitest, Knip (dead code), dependency-cruiser, lefthook (git hooks)

## Options

```
--dry-run        Preview changes without writing files
--yes            Skip prompts; conflicting files get Git-style conflict markers
--backup         Back up existing files before overwriting or writing conflicts
--force          Overwrite conflicts without prompting
--no-install     Skip dependency installation
--no-check       Skip post-apply typecheck/lint/test run
--pm <manager>   Package manager: npm | pnpm | yarn | bun
--cwd <path>     Target directory (default: current directory)
```

## How it works

`strong-mode` compares 13 managed files from its template against your project. New files are created automatically. Existing managed files can be merged, skipped, overwritten, or written with Git-style conflict markers depending on the file type and flags you use. `package.json` is handled structurally, so scripts and dependencies are added without flattening the rest of your project config.

## Contributing

```bash
npm install
npm run sync:template   # sync scaffold into CLI package
npm run check           # typecheck + lint + test
npm run build           # build CLI
```

Test locally:

```bash
npm run build -w strong-mode
node packages/strong-mode/dist/cli.js --dry-run --yes
```

## CI and Release

- `.github/workflows/ci.yml` runs install, check, build, `npm pack`, and smoke tests of the packed CLI on every push/PR: a dry run, a real apply on a fresh ESM project that must then pass its own `check` (including dead code), and a CommonJS project that must be rejected.
- `.github/workflows/publish.yml` reruns validation, packs the tarball, smoke-tests it, and publishes `packages/strong-mode` on `v*` tags or manual dispatch.
- The first npm publish for a new package may need to be done manually. After the package exists, configure npm trusted publishing to trust this repository and `.github/workflows/publish.yml`.

## Roadmap / Known limitations

- **CommonJS projects are not supported yet.** The template is ESM-only (`module: NodeNext` + `verbatimModuleSyntax`), so `strong-mode` stops before writing anything when `package.json` has `"type": "commonjs"`. Planned: a CommonJS-aware `tsconfig.json` (`verbatimModuleSyntax: false`, with `consistent-type-imports` keeping type-only imports explicit), and no longer switching a `package.json` without `"type"` to `"module"`.
- **Dead-code detection assumes a `src/index.ts` entry.** `knip.config.ts` pins `entry` and `project`, so frameworks with other entry points (Next.js, Vite, Astro, …) get false "unused file" reports. Planned: drop the pinned entries and let knip's framework plugins detect them.
- **Upgrading from an older strong-mode.** Re-running `strong-mode` on a project that already has an older version of the managed files treats every changed file as a conflict (Git-style markers with `--yes`). Planned: recognize previously shipped template versions and update them in place.
- **Runtime dependencies are merged per section.** Template `devDependencies` already skip packages the project declares in `dependencies`, but the reverse is not handled yet: a template runtime dependency (for example `zod`) that the project lists in `devDependencies` is added again to `dependencies`. Planned: treat a package declared in either section as present.
