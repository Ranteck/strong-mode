# slop-free

Retrofit any TypeScript project with ultra-strict anti-slop defaults.

```bash
npx slop-free
```

Adds strict TypeScript, ESLint, formatting, and quality gates to your existing project — without touching your existing code.

## What it installs

**TypeScript** (`tsconfig.json`):

- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`
- `skipLibCheck: false`

**ESLint** (`eslint.config.mjs`):

- No `any`, no `ts-expect-error` without a 10-char description, no chained assertions (`as unknown as T`)
- `process.env` access restricted to `src/env.ts`
- Complexity limits: cyclomatic ≤ 10, depth ≤ 3, params ≤ 4

**Runtime validation** (`src/env.ts`):

- Zod-based env validation template — all `process.env` access goes through here

**Quality gates** (npm scripts):

- `check`: typecheck + lint + format check + dead code (fast, pre-commit)
- `quality`: check + tests + coverage + dep graph + dep cycles + audit (full)

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

`slop-free` compares 9 config files from its template against your project. New files are created. Conflicts in managed files prompt for Git-style conflict markers, overwrite, skip, or a diff preview. With `--yes`, managed-file conflicts write markers by default; with `--force`, they overwrite. Your `package.json` is merged structurally — dependencies and scripts are added, your existing fields are preserved.

## Contributing

```bash
npm install
npm run sync:template   # sync scaffold into CLI package
npm run check           # typecheck + lint + test
npm run build           # build CLI
```

Test locally:

```bash
npm run build -w slop-free
node packages/slop-free/dist/cli.js --dry-run --yes
```

## CI and Release

- `.github/workflows/ci.yml` runs install, check, build, and `npm pack` on every push/PR.
- `.github/workflows/publish.yml` publishes `packages/slop-free` to npm on `v*` tags or manual dispatch.
- To use npm trusted publishing, configure the package on npm to trust this repository and the exact workflow file `.github/workflows/publish.yml`.
