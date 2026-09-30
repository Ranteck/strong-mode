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
- CRITIQUE pass cap: 4 (raised from 3 by the user after pass 3, for one bounded round)
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

Design rule: decide which program each command actually runs. When a case is ambiguous, prefer not detecting Vitest, because a false positive adds a Vitest-only test to a project that uses another runner.

1. Per command (the existing split on `&&`, `||`, `;` and `|`, with quotes stripped from words), skip leading environment assignments (`VAR=value`). The program is the first remaining word, compared by its base name (no path prefix, split on `/` and `\`) with any `@version` suffix removed. Arguments and file paths after the program never count.
2. When the program is a launcher, continue with what it launches:
   - `npx`, `bunx`, `pnpx`, `cross-env`, `env`: the next word that is neither a flag (starts with `-`) nor an assignment, also skipping the separate value of options that take one: `-p`/`--package` (npx, pnpx, bunx), `-u`/`--unset` and `-C`/`--chdir` (env). With `-c`/`--call` (npx, pnpx, bunx) or `-S`/`--split-string` (env) the command is a string: ambiguous, so not Vitest.
   - `dotenv`: the words after `--` when present; otherwise the next word that is not a flag, skipping the separate values of `-e`, `-c` and `-v`.
   - `npm`, `pnpm`, `yarn`, `bun`, also when path-qualified (`/usr/bin/npm`): after the package manager, skip flags, the separate value of options that take one (`--prefix`, `-C`, `--dir`, `--filter`, `-F`, `--workspace`, `-w`, `--cwd`), and Yarn's `workspace <name>`. The first word left decides; subcommands are never searched for further along, so a runner's own arguments (`yarn vitest run`) are not mistaken for one. If it is `exec`, `dlx` or `x`, the program is the next word that is not a flag, handled like a launcher (`npm exec --package vitest -- jest` runs jest; `-c`/`--call` is ambiguous, so not Vitest); the package manager's own value-taking options above stay recognized after the subcommand too, so `npm exec -w app -- vitest` runs vitest. If it is `run` or `run-script`, the next word that is not a flag names a delegated script; for `yarn` and `bun`, when no script has that name, it is the program instead (they fall back to a dependency binary). Any other word is a delegated script name when the package manager is `npm` or when that name is an existing key in `scripts`; otherwise it is the program.
3. A command runs Vitest when its final program is `vitest`. The delegation search uses the same package-manager analysis, so `npm --prefix . run x` delegates to `x` and `yarn workspace app run vitest` delegates to the `vitest` script.
4. Keep: `jest --coverageDirectory=.vitest-coverage` is not Vitest; delegation cycles stop the search; `npm test` and `npm --silent run x` keep delegating as today. Respect the CLI's ESLint limits (explicit return types, complexity) by splitting helpers as needed.
5. Known limitation, do not address: quoting is not shell-accurate (a separator inside quotes still splits the command).

**B. `packages/strong-mode/src/apply/scripts.test.ts`** — add cases, keeping every existing case passing:

1. True: `{ test: "dotenv -e .env.test -- vitest run" }`, `{ test: "env TZ=UTC vitest run" }`, `{ test: "pnpm --filter app exec vitest" }`, `{ test: "npx vitest@3 run" }`, `{ test: "yarn vitest" }` (no `vitest` script), `{ test: "npm run vitest", vitest: "vitest run" }`, `{ test: "npm --prefix . run x", x: "vitest run" }`, `{ test: "NODE_ENV=test node_modules/.bin/vitest" }`, `{ test: "cross-env CI=1 vitest" }`, `{ test: "npm exec -- vitest" }`, `{ test: "yarn vitest run --coverage" }`, `{ test: "yarn run vitest" }` (no `vitest` script), `{ test: "bun run vitest" }` (no `vitest` script), `{ test: "npm exec -w app -- vitest" }`.
2. False: `{ test: "npm exec --workspace vitest -- jest" }`, `{ test: "yarn jest run vitest", vitest: "vitest run" }`, `{ test: "npx --package vitest jest" }`, `{ test: "npm exec --package vitest -- jest" }`, `{ test: "env -u vitest node --test" }`, `{ test: "npm run vitest" }` (no `vitest` script; npm does not fall back to binaries), `{ test: "npm run vitest", vitest: "jest" }`, `{ test: "yarn vitest", vitest: "jest" }`, `{ test: "jest vitest" }`, `{ test: "jest --config vitest" }`, `{ test: "echo vitest" }`, `{ test: "node scripts/vitest" }`, `{ test: "npm --prefix . run vitest", vitest: "jest" }`, `{ test: "/usr/bin/npm run vitest", vitest: "jest" }`, `{ test: "yarn workspace app run vitest", vitest: "jest" }`.

**C. Docs** — in `README.md`, `packages/strong-mode/README.md` and `CLAUDE.md`, wherever the text lists the files that `--yes` merges structurally (`tsconfig.json`, `tsconfig.eslint.json`, `.gitignore`), add `.prettierignore` (merged by lines like `.gitignore`). Change nothing else in those files.

**Out of scope, unchanged:** `merge.ts` ignore-file deduplication, `patchers.ts` `engines` handling, every other file.

**Acceptance criteria** (checked by Claude in VERIFY):

1. `npm run test -w strong-mode` passes, including the new cases.
2. In a temporary copy: the `dotenv`, `env`, `pnpm --filter` and `@version` true cases fail against `scripts.ts` from e759db1, the `jest vitest`, `node scripts/vitest`, `--prefix` and `/usr/bin/npm` false cases fail against `scripts.ts` from 37e8e6f, and the `yarn vitest run --coverage`, `yarn jest run vitest` and `npx --package vitest jest` cases fail against `scripts.ts` from fc62173.
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

##### REFACTOR-r01

- **Actors/backend**: reviewer Codex (fresh read-only CRITIQUE); writer Codex (fresh write session after the resumed write was rejected); orchestrator Claude; backend codex
- **CRITIQUE outcome**: 3 P2 findings on scripts.ts; docs judged correct
- **DEBATE classifications**: valid: the "any non-flag word" rule turns arguments into false positives (`jest vitest`, `tsc -p vitest`, `node scripts/vitest`); valid: separate option values break delegation (`npm --prefix . run x`, `yarn workspace app run vitest`); valid (P3): path-qualified package managers not recognized
- **Resulting writer work**: scripts.ts reworked to resolve the program each command runs (launchers, package-manager subcommands found anywhere, base-name and @version normalization, shared delegation analysis); scripts.test.ts: the r01 contract cases; contract A and B rewritten, user re-approved the revised plan
- **Checkpoint**: locate-by-feature-and-round
- **Decision notes**: false positives are worse than false negatives here (a Vitest-only test in another runner's suite breaks it, and the README promises it is not added), so ambiguous forms now resolve to "not Vitest"; the resumed `--resume-last --write` attempt was rejected by the read-only sandbox, snapshots proved no partial write, and a fresh write session with an inline continuity summary applied the fix

##### REFACTOR-r02

- **Actors/backend**: reviewer Codex (resumed read-only CRITIQUE with continuity summary); writer Codex (fresh write session); orchestrator Claude; backend codex
- **CRITIQUE outcome**: 3 P2 findings on the r01 resolver
- **DEBATE classifications**: valid (regression vs e759db1): package-manager subcommand searched anywhere, so `yarn vitest run --coverage` was false and `yarn jest run vitest` true; valid (P3, contrived): launcher option values read as the program (`npx --package vitest jest`, `npm exec --package vitest -- jest`, `env -u vitest node --test`); valid (P3): Yarn and bun `run <bin>` fallback to a dependency binary ignored
- **Resulting writer work**: scripts.ts: package-manager analysis by position after skipping known value-taking options and Yarn `workspace <name>`, launcher value options, `-c`/`--call` and `env -S` treated as ambiguous, Yarn/bun `run` binary fallback; scripts.test.ts: the r02 cases; contract rule A2 and the B lists rewritten, user re-approved
- **Checkpoint**: locate-by-feature-and-round
- **Decision notes**: not a restatement of pass 1 (that covered package-manager option values, fixed in r01; these are subcommand position and launcher options); the resume attempt was skipped because the latest thread was the read-only CRITIQUE and `--resume-last --write` had been rejected in both earlier rounds, so a fresh write session with an inline continuity summary was used directly; pass 3 is the last CRITIQUE allowed by the cap, and further heuristic edge cases go to the user instead of another round

##### REFACTOR-r03

- **Actors/backend**: reviewer Codex (resumed read-only CRITIQUE, pass 3); writer Codex (fresh write session); orchestrator Claude; backend codex
- **CRITIQUE outcome**: 1 P2 finding: after `exec`, only `-p`/`--package` were recognized as value options (scripts.ts:146); no other in-scope findings
- **DEBATE classifications**: valid: `npm exec -w app -- vitest` returned false (documented npm workspace syntax) and `npm exec --workspace vitest -- jest` returned true
- **Resulting writer work**: scripts.ts: exec parsing uses the union of package-manager and exec value options; scripts.test.ts: the two cases; contract A2 and B updated
- **Checkpoint**: locate-by-feature-and-round
- **Decision notes**: pass 3 reached the cap of 3; the user chose one more bounded round and the cap was raised to 4; from pass 4 on, the built-in /code-review at max effort runs in parallel with each Codex CRITIQUE (user request)
