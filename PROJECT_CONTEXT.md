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
- CRITIQUE pass cap: open (user, 2026-09-30, after pass 4): continue until a pass leaves no realistic valid finding; the anti-loop cutoff still applies
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
   - `dotenv`: the next word that is not a flag, skipping the separate values of `-e`, `-c` and `-v`; a `--` reached before that word starts the command, while a `--` after it belongs to the program (`dotenv jest -- vitest` runs jest).
   - `npm`, `pnpm`, `yarn`, `bun`, also when path-qualified (`/usr/bin/npm`): after the package manager, skip flags, the separate value of that package manager's own options that take one, and Yarn's `workspace <name>`. Keep those options in a per-manager table keyed by `PackageManager` (like the tables in `package-manager.ts`): npm `--prefix`, `-w`/`--workspace`; pnpm `-C`/`--dir`, `--filter`/`-F` (pnpm's `-w` is the boolean `--workspace-root` and takes no value); yarn `--cwd`; bun `--cwd`, `--filter`/`-F`; confirm each against the manager's documentation. Package selection belongs to the whole package-manager command: look for it in every word of that command up to `--`, before and after the subcommand and the script name (`npm run unit --workspace api` selects `api`). It counts both the value-taking options in the table (a directory option counts only when its value is not `.` or `./`) and the boolean selectors, kept in a second per-manager table: npm `--workspaces`/`-ws`; pnpm `-r`/`--recursive`; Yarn's `workspace <name>` and `workspaces ...`; bun's as its documentation lists; confirm each against the manager's documentation. Selection propagates: everything that a package-selecting command launches (an `exec` target, a nested package-manager command such as `pnpm --filter api exec npm run unit`) resolves in that other-package context, where an explicit `vitest` program still counts (`pnpm --filter app exec vitest` runs vitest) but any delegated script name is ambiguous, so not Vitest. The first word left decides; subcommands are never searched for further along, so a runner's own arguments (`yarn vitest run`) are not mistaken for one. If it is `exec`, `dlx` or `x`, the program is the next word that is not a flag, handled like a launcher (`npm exec --package vitest -- jest` runs jest; `-c`/`--call` is ambiguous, so not Vitest); the package manager's own value-taking options above stay recognized after the subcommand too, so `npm exec -w app -- vitest` runs vitest. If it is `run` or `run-script`, the next word that is not a flag names a delegated script; for `yarn` and `bun`, when no script has that name, it is the program instead (they fall back to a dependency binary). Any other word: built-in commands win over scripts. For `npm`, it is a delegated script name only for the commands that run scripts (`test`, `t`, `tst`, `start`, `stop`, `restart`); any other npm command (`npm ci`) is neither a delegation nor Vitest. For `pnpm`, `yarn` and `bun`, a word that is one of that manager's own built-in commands runs the built-in (neither a delegation nor Vitest; `bun test` is Bun's own test runner and `yarn check` is Yarn's integrity check); otherwise it is a delegated script name when it is an existing key in `scripts`, and otherwise it is the program. Keep the built-in command lists in a per-manager table keyed by `PackageManager`, compiled from each CLI's documentation.
3. A command runs Vitest when its final program is `vitest`. The delegation search uses the same package-manager analysis, so `npm --prefix . run x` delegates to `x`, while `yarn workspace app run vitest` selects another package and is therefore ambiguous (not Vitest).
4. Keep: `jest --coverageDirectory=.vitest-coverage` is not Vitest; delegation cycles stop the search; `npm test` and `npm --silent run x` keep delegating as today. Respect the CLI's ESLint limits (explicit return types, complexity) by splitting helpers as needed. Reuse `PACKAGE_MANAGERS` and `PackageManager` from `src/types.ts` instead of a local set, and type the package-manager helpers with `PackageManager`.
5. Known limitation, do not address: quoting is not shell-accurate (a separator inside quotes still splits the command).

**B. `packages/strong-mode/src/apply/scripts.test.ts`** — add cases, keeping every existing case passing:

1. True: `{ test: "dotenv -e .env.test -- vitest run" }`, `{ test: "env TZ=UTC vitest run" }`, `{ test: "pnpm --filter app exec vitest" }`, `{ test: "npx vitest@3 run" }`, `{ test: "yarn vitest" }` (no `vitest` script), `{ test: "npm run vitest", vitest: "vitest run" }`, `{ test: "npm --prefix . run x", x: "vitest run" }`, `{ test: "NODE_ENV=test node_modules/.bin/vitest" }`, `{ test: "cross-env CI=1 vitest" }`, `{ test: "npm exec -- vitest" }`, `{ test: "yarn vitest run --coverage" }`, `{ test: "yarn run vitest" }` (no `vitest` script), `{ test: "bun run vitest" }` (no `vitest` script), `{ test: "npm exec -w app -- vitest" }`, `{ test: "pnpm -w vitest run" }`, `{ test: "pnpm -w test:unit", "test:unit": "vitest run" }`, `{ test: "yarn unit", unit: "vitest run" }`, `{ test: "npm start", start: "vitest" }`, and `{ ci: "npm test", test: "vitest run" }` evaluated for `ci`.
2. False: `{ test: "npm run unit --workspace api", unit: "vitest run" }`, `{ test: "npm --workspaces run unit", unit: "vitest run" }`, `{ test: "npm run unit -ws", unit: "vitest run" }`, `{ test: "pnpm -r run unit", unit: "vitest run" }`, `{ test: "pnpm --filter api exec npm run unit", unit: "vitest run" }`, `{ test: "yarn check --integrity", check: "vitest run" }`, `{ test: "npm ci", ci: "vitest run" }`, `{ ci: "bun test", test: "vitest run" }` evaluated for `ci`, `{ test: "npm --workspace api run unit", unit: "vitest run" }`, `{ test: "pnpm --filter app run unit", unit: "vitest run" }`, `{ test: "dotenv jest -- vitest" }`, `{ test: "npm exec --workspace vitest -- jest" }`, `{ test: "yarn jest run vitest", vitest: "vitest run" }`, `{ test: "npx --package vitest jest" }`, `{ test: "npm exec --package vitest -- jest" }`, `{ test: "env -u vitest node --test" }`, `{ test: "npm run vitest" }` (no `vitest` script; npm does not fall back to binaries), `{ test: "npm run vitest", vitest: "jest" }`, `{ test: "yarn vitest", vitest: "jest" }`, `{ test: "jest vitest" }`, `{ test: "jest --config vitest" }`, `{ test: "echo vitest" }`, `{ test: "node scripts/vitest" }`, `{ test: "npm --prefix . run vitest", vitest: "jest" }`, `{ test: "/usr/bin/npm run vitest", vitest: "jest" }`, `{ test: "yarn workspace app run vitest", vitest: "jest" }`.

**C. Docs** — in `README.md`, `packages/strong-mode/README.md` and `CLAUDE.md`, wherever the text lists the files that `--yes` merges structurally (`tsconfig.json`, `tsconfig.eslint.json`, `.gitignore`), add `.prettierignore` (merged by lines like `.gitignore`). Change nothing else in those files.

**Out of scope, unchanged:** `merge.ts` ignore-file deduplication, `patchers.ts` `engines` handling, every other file.

**Acceptance criteria** (checked by Claude in VERIFY):

1. `npm run test -w strong-mode` passes, including the new cases.
2. In a temporary copy: the `dotenv`, `env`, `pnpm --filter` and `@version` true cases fail against `scripts.ts` from e759db1, the `jest vitest`, `node scripts/vitest`, `--prefix` and `/usr/bin/npm` false cases fail against `scripts.ts` from 37e8e6f, the `yarn vitest run --coverage`, `yarn jest run vitest` and `npx --package vitest jest` cases fail against `scripts.ts` from fc62173, the `pnpm -w vitest run`, `npm --workspace api run unit` and `dotenv jest -- vitest` cases fail against `scripts.ts` from 2064cc6, and the `npm run unit --workspace api`, `npm --workspaces run unit`, `pnpm --filter api exec npm run unit`, `yarn check --integrity`, `npm ci` and `bun test` cases fail against `scripts.ts` from 09203bf.
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

##### REFACTOR-r04

- **Actors/backend**: reviewer Codex (resumed read-only CRITIQUE, pass 4) plus a parallel Claude /code-review (only its reuse angle finished before the session limit); writer Codex (fresh write session); orchestrator Claude; backend codex
- **CRITIQUE outcome**: Codex: 2 P2 (other-package delegation resolved against root scripts; dotenv `--` shortcut skipping the identified program); /code-review: pnpm's boolean `-w` treated as value-taking, duplicated `PACKAGE_MANAGERS`, and an out-of-scope note on execute.ts ESLint regexes
- **DEBATE classifications**: valid: other-package delegation (`npm --workspace api run unit`); valid: pnpm `-w` is `--workspace-root`, so a per-manager option table; valid (P3): dotenv shortcut; valid (P3): reuse `PACKAGE_MANAGERS`/`PackageManager` from src/types.ts; deferred to a follow-up PR: execute.ts ESLint-config regexes disagree with the resolver
- **Resulting writer work**: scripts.ts: per-`PackageManager` value-option table, other-package delegations ambiguous, dotenv handled by `positionalWords` only, shared types; scripts.test.ts: r04 cases, and the `npm --workspace app run vitest` / `yarn workspace app run vitest` delegation cases moved from expecting true to a "does not resolve another package's vitest script locally" block, as the revised contract requires
- **Checkpoint**: locate-by-feature-and-round
- **Decision notes**: the user opened the pass cap (continue until a pass leaves no realistic valid finding, with the anti-loop cutoff); the two moved test expectations follow the approved behavior change, not a weakening; Codex checked the per-manager option lists against npm, pnpm, Yarn and Bun documentation with no deviation

##### REFACTOR-r05

- **Actors/backend**: reviewer Codex (resumed read-only CRITIQUE, pass 5) plus a parallel Claude /code-review at max (cut off by the session limit before any agent finished); writer Codex (fresh write session, interrupted before its report, then a second fresh write session that completed it); orchestrator Claude (the user's main account through the r05 dispatch, their personal account from the completion on); backend codex
- **CRITIQUE outcome**: Codex: 4 P2, all marked realistic: package selection read only before the script name (`npm run unit --workspace api`); boolean selectors ignored (`npm --workspaces`, `-ws`, `pnpm -r`); `exec` did not propagate the selection (`pnpm --filter api exec npm run unit`); an existing script beat the package manager's own command (`yarn check --integrity`, `npm ci`, `bun test`)
- **DEBATE classifications**: valid: all four; the first three are one class (the command selected another package) and the fourth a second class (built-in commands), so the fix closes both classes instead of patching variants; the user approved the plan
- **Resulting writer work**: scripts.ts: package selection over the whole package-manager command up to `--`, a per-manager boolean-selector table, selection propagated into launched commands, built-in commands winning over scripts with an npm script-running allowlist and per-manager built-in tables compiled from each CLI's documentation; scripts.test.ts: the r05 cases plus pnpm reserved-name, nested-launcher and `dotenv CI=1 vitest` cases; no pre-existing expectation changed
- **Checkpoint**: locate-by-feature-and-round
- **Decision notes**: the first r05 write session died with the Claude session during its own verification and left its edits uncommitted; reconciling them against contract B found one missing case (`npm start`), and because Codex thread state is per Claude account, the completion ran as a fresh write session with an inline continuity summary instead of `--resume-last`; that session also added ten pnpm reserved command names and made `dotenv CI=1 vitest` false (dotenv takes assignments only through `-v`), both within contract A; the pnpm and Yarn built-in tables include `test`/`start`, so `{ test: "pnpm start", start: "vitest" }` now resolves to "not Vitest" (true at 09203bf), a contract gap raised for pass 6 triage; the parallel /code-review runs at high effort from pass 6 on
