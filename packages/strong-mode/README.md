# strong-mode

Safe vibe coding for TypeScript.

```bash
npx strong-mode
```

`strong-mode` hardens existing TypeScript projects with strict defaults, sharper lint rules, and quality guardrails built for AI-assisted coding. It upgrades the tooling around your codebase without rewriting the app itself.

## What it installs

`strong-mode` layers a strict baseline onto an existing repository. You keep your app code; it adds the rails around it.

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

`strong-mode` compares 10 managed files from its template against your project. New files are created automatically. Existing managed files can be merged, skipped, overwritten, or written with Git-style conflict markers depending on the file type and flags you use. `package.json` is handled structurally, so scripts and dependencies are added without flattening the rest of your project config.

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

- `.github/workflows/ci.yml` runs install, check, build, `npm pack`, and a smoke test of the packed CLI on every push/PR.
- `.github/workflows/publish.yml` reruns validation, packs the tarball, smoke-tests it, and publishes `packages/strong-mode` on `v*` tags or manual dispatch.
- The first npm publish for a new package may need to be done manually. After the package exists, configure npm trusted publishing to trust this repository and `.github/workflows/publish.yml`.
