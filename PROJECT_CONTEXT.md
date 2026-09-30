# PROJECT_CONTEXT

## vitest-command-detection

### Quality gate

- mode: check-only
- command: npm run typecheck -w strong-mode && npm run lint -w strong-mode && npm run format:check
- cwd: /home/denis/Proyectos/strong-mode-gates
- provenance: .github/workflows/ci.yml -> step "Run checks" -> packages/strong-mode/package.json#scripts.check (typecheck && lint && test), split into its mechanical subcommands (test moved to VERIFY); plus package.json#scripts.format:check, which lefthook runs on pre-commit
- resolution: user-confirmed
- definition sources: .github/workflows/ci.yml, package.json, packages/strong-mode/package.json, lefthook.yml

### Critique assurance

- mode: standard
- resolution: default-standard-no-trigger
- trigger matches: none
- trigger evidence: no CLI contract, schema or persisted-format change; no destructive or irreversible writes; at most 5 changed files; unit tests exercise the changed function
- lens count: 1
- lens set: standard
- exit challenger: disabled
- CRITIQUE pass cap: 3
- Codex review/debate call budget: not-applicable (standard)

### Backend

- backend: codex
- resolution: default-codex
- resolved session: not-applicable
- disclosure: not-applicable

### Checkpoint commits

- authorized: yes (local commits on fix/generated-project-gates only; no push, no history rewrite)
- basis: no commit.gpgsign; lefthook pre-commit runs check-only commands (format:check, lint, typecheck); prepare-commit-msg has no configured command; branch checked out, not detached

### Feature contract

#### Current state

Scope: fix how strong-mode decides whether a project's test script runs Vitest, and correct the docs about which files `--yes` merges. Work in the worktree /home/denis/Proyectos/strong-mode-gates (branch fix/generated-project-gates, PR #9). Keep changes minimal and in the existing style; follow CLAUDE.md (explicit return types, strict TypeScript, kebab-case files).

**A. `packages/strong-mode/src/apply/scripts.ts`** (the exported `scriptRunsVitest(scripts, name = "test")` keeps its signature and its callers stay unchanged)

1. A command (the existing split on `&&`, `||`, `;` and `|`, with quotes stripped from words) runs Vitest when any of its words that is not a flag (does not start with `-`) and not an environment assignment (`VAR=value`), after removing any path prefix and any `@version` suffix, is exactly `vitest`. This replaces the current "first program after launchers" heuristic (`executableOf` and `wrapperLength`), which misses flag values and unknown launchers.
2. Exception: a word that names a script in a package-manager delegation is not treated as a program. That covers `npm|pnpm|yarn|bun run <name>` and `... run-script <name>` (flags may appear anywhere), and a bare `pnpm|yarn|bun <name>` when `<name>` is an existing key in `scripts`. Those names are followed only through the existing delegation search, so the script they point to decides.
3. Keep: `jest --coverageDirectory=.vitest-coverage` is not Vitest; delegation cycles stop the search; `npm test` and `npm --silent run x` keep delegating as today.
4. Known limitation, do not address: quoting is not shell-accurate (a separator inside quotes still splits the command).

**B. `packages/strong-mode/src/apply/scripts.test.ts`** — add cases, keeping every existing case passing:

1. True: `{ test: "dotenv -e .env.test -- vitest run" }`, `{ test: "env TZ=UTC vitest run" }`, `{ test: "pnpm --filter app exec vitest" }`, `{ test: "npx vitest@3 run" }`, `{ test: "yarn vitest" }` (no `vitest` script), `{ test: "npm run vitest", vitest: "vitest run" }`.
2. False: `{ test: "npm run vitest", vitest: "jest" }`, `{ test: "yarn vitest", vitest: "jest" }`.

**C. Docs** — in `README.md`, `packages/strong-mode/README.md` and `CLAUDE.md`, wherever the text lists the files that `--yes` merges structurally (`tsconfig.json`, `tsconfig.eslint.json`, `.gitignore`), add `.prettierignore` (merged by lines like `.gitignore`). Change nothing else in those files.

**Out of scope, unchanged:** `merge.ts` ignore-file deduplication, `patchers.ts` `engines` handling, every other file.

**Acceptance criteria** (checked by Claude in VERIFY):

1. `npm run test -w strong-mode` passes, including the new cases.
2. The new cases in B fail against `scripts.ts` from commit e759db1 (checked in a temporary copy).
3. `npm run build -w strong-mode && node packages/strong-mode/dist/cli.js --dry-run --yes` succeeds and the template copy stays in sync.
4. `/e2e-pm-matrix`: npm and pnpm pass; Yarn Classic and bun fail only with the documented sonarjs limitation.

#### Round log

##### IMPL-r00

- **Actors/backend**: orchestrator Claude (contract, gate, commits); writer Codex via codex:codex-rescue with --write and cwd /home/denis/Proyectos/strong-mode-gates; backend codex
- **CRITIQUE outcome**: not applicable
- **DEBATE classifications**: not applicable
- **Resulting writer work**: scripts.ts: Vitest detected among non-flag words (path and @version normalized), delegated script names excluded; scripts.test.ts: the eight contract cases; README.md, packages/strong-mode/README.md, CLAUDE.md: `.prettierignore` listed among the files `--yes` merges
- **Checkpoint**: locate-by-feature-and-round
- **Decision notes**: contract derived from the 2026-09-30 review-only pass on the 7 unpushed PR #9 commits (Codex plus the apply-invariants reviewer); quoted-separator splitting and ignore-file negation ruled false positives; the pre-existing `engines` override is deferred to a separate PR
