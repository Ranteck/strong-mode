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

- mode: elevated
- resolution: user-requested
- trigger matches: user explicit request (2026-10-06, after CRITIQUE pass 6)
- trigger evidence: six single-thread CRITIQUE passes each surfaced new variants of the same package-context class in packages/strong-mode/src/apply/scripts.ts; the user asked for several passes up front before continuing the cycle
- lens count: 3
- lens set: correctness-contracts; integration-state-reproducibility; security-abuse-data-loss
- exit challenger: required-before-verify-or-done-rerun-until-clean
- CRITIQUE pass cap: open (user, 2026-09-30, after pass 4): continue until a pass leaves no realistic valid finding; the anti-loop cutoff still applies
- Codex review/debate call budget: 13, counted from the elevated sweep (CRITIQUE pass 7) on

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

Scope: make strong-mode add its Vitest-only test file `tests/env.test.ts` only when the project's `test` script clearly runs only Vitest, keep the input validation and logging around that decision safe, and correct the docs about which files `--yes` merges. Work in the worktree /home/denis/Proyectos/strong-mode-gates (branch fix/generated-project-gates, PR #9). Keep changes minimal and in the existing style; follow CLAUDE.md (explicit return types, strict TypeScript, kebab-case files).

Design rule: recognize only the obvious forms and reject everything else. A false negative only skips the generated file, and the user is told to add it; a false positive puts a Vitest-only file where another runner collects it. This detector is a small helper, not a shell or package-manager emulator: do not add parsing for forms outside the list below.

**A. `packages/strong-mode/src/apply/scripts.ts`** — `scriptRunsVitest(scripts, name = "test")` keeps its signature and its caller. It returns true only when the script `name`, every script it delegates to, and their hooks use only the forms below, and at least one command is a Vitest command. It never throws.

1. Syntax: a script is commands joined only by `&&`; within a command, words are separated by spaces or tabs. A script containing any other shell character (`|`, `;`, a single `&`, `<`, `>`, `(`, `)`, `{`, `}`, `$`, a backtick, `'`, `"`, `#`, a newline, `!`, `*`, `?`) is not recognized.
2. Vitest command: optionally `cross-env`; then optional assignments to `NODE_ENV`, `CI` or `TZ` (`NAME=value`); then `vitest`; then optionally `run` or `watch`; then only flags from this list: `--run`, `--coverage`, `--passWithNoTests`, `--silent`, `--reporter=<name>`. Anything else in the command (another word, another flag, a path-qualified or versioned executable) makes it not recognized.
3. Delegation: `npm run <script>`, `pnpm run <script>`, `yarn run <script>`, `bun run <script>`; `npm test`, `pnpm test`, `yarn test` (the `test` script); and `pnpm <script>` or `yarn <script>` when the script name contains `:`. `--silent` or `-s` may appear between the package manager and `run` or `test`. No other word may follow the script name. The script must be an own key of `scripts` (`Object.hasOwn`) with a string value; otherwise the command is not recognized.
4. Preparation command: a command whose first word is exactly `tsc`, `eslint` or `prettier` is recognized with any arguments; it is neither Vitest nor another runner.
5. Hooks: for every script visited (the starting script and each delegated one), an own `pre<script>` or `post<script>` script, when present, must also consist only of recognized commands.
6. Limits: a delegation cycle, or visiting more than 32 scripts, makes the result false. Evaluate each script once (memoize), so shared delegations cost linear work.
7. Everything else is not recognized, and the result is false: other runners (`jest`, `node --test`, `playwright test`, `bun test`), `||`, `cd`, `env`, `dotenv`, `npx`, `exec`, `dlx`, `x`, package or root selectors, any other option. Remove the built-in command tables, the per-manager option tables and the option parser that the old rule needed. Keep the CLI's ESLint limits (explicit return types, complexity).

**B. `packages/strong-mode/src/apply/scripts.test.ts`** — do not delete existing cases: keep each as a row of a table of `{ scripts, name?, expected }`. Report every row whose expected value changes and the rule above that changes it (for example `npx vitest@3 run`, `dotenv -e .env.test -- vitest run`, `env TZ=UTC vitest run`, `yarn vitest`, `pnpm --filter app exec vitest`, `pnpm -w vitest run`, `yarn unit` become false). Add: false for `{ test: "jest && vitest run" }`, `{ test: "vitest run", posttest: "jest" }`, `{ test: "false && vitest || jest" }`, `{ test: "npm run toString" }` and `{ test: "yarn constructor" }` (no exception); true for `{ test: "tsc --noEmit && vitest run" }`, `{ test: "pnpm test:unit", "test:unit": "vitest run" }`, `{ ci: "pnpm test", test: "vitest run" }` evaluated for `ci`, `{ test: "cross-env NODE_ENV=test vitest run" }`, `{ test: "vitest run", pretest: "eslint ." }`; a 3000-script `npm run` chain and a 24-level diamond (each level `npm run sN && npm run sN`) both return false quickly and without throwing; a non-string script value (built with `JSON.parse`) returns false without throwing.

**C. Input validation and logging**

1. `packages/strong-mode/src/apply/detect.ts`: when reading `package.json`, if `scripts` is present it must be an object whose values are all strings; otherwise fail with a clear error that names the file and the offending script, before planning or writing anything.
2. `packages/strong-mode/src/apply/execute.ts`: the message logged when `tests/env.test.ts` is skipped must not include the script body; it says that the `test` script could not be confirmed to run only Vitest and that the user can add the file if it does. Update its test if one asserts the message.

**D. Docs** — in `README.md`, `packages/strong-mode/README.md` and `CLAUDE.md`: wherever the text lists the files that `--yes` merges structurally (`tsconfig.json`, `tsconfig.eslint.json`, `.gitignore`), `.prettierignore` is listed (merged by lines like `.gitignore`); and the sentence that says when `tests/env.test.ts` is added says it is added only when the `test` script clearly runs only Vitest. Change nothing else in those files.

**Out of scope, unchanged:** `merge.ts` ignore-file deduplication, `patchers.ts` `engines` handling, the partial-write message in `cli.ts`, every other file. Forms such as `npx`, `dotenv`, `run-s`, `concurrently`, workspaces and other launchers are deliberately not recognized.

**Acceptance criteria** (checked by Claude in VERIFY):

1. `npm run test -w strong-mode` passes, including the new cases, and `execute.test.ts` keeps passing.
2. `scripts.ts` is on the order of 100 lines.
3. In a temporary copy, against `scripts.ts` from d7aa199: `{ test: "jest && vitest run" }`, `{ test: "vitest run", posttest: "jest" }` and `{ test: "false && vitest || jest" }` return true, and `{ test: "npm run toString" }` throws.
4. `npm run build -w strong-mode && node packages/strong-mode/dist/cli.js --dry-run --yes` succeeds and the template copy stays in sync.
5. `/e2e-pm-matrix`: npm and pnpm pass; Yarn Classic and bun fail only with the documented sonarjs limitation.

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

##### REFACTOR-r06

- **Actors/backend**: reviewers Codex (CRITIQUE pass 6, standard; then pass 7, elevated: three fresh lenses correctness-contracts, integration-state-reproducibility, security-abuse-data-loss, plus a fresh canonicalization) and a parallel Claude /code-review at high effort on pass 6; writer Codex (fresh write session with an inline continuity summary); orchestrator Claude; backend codex
- **CRITIQUE outcome**: pass 6: Codex 8 findings, /code-review 10; pass 7 (artifact identity 50b7135857b6b15aba3a455f3bde872fba46167c1f7811522879b68fb725c385, unchanged across the sweep): a canonical ledger of 47 failure classes, among them mixed runners admitted by `.some()`, lost control-flow reachability, context changes (`cd`, `env -C`, `npm_config_*`, root selectors), unknown option arity, script-running built-ins treated as opaque, prototype-key and non-string crashes, unbounded and exponential delegation, and the skip log printing the script body; all three lenses recommended a closed, deny-by-default rule
- **DEBATE classifications**: valid: the root cause is the open-ended emulation itself, so the classes are closed by replacing it rather than patched one by one; valid: mixed runners (P1), prototype keys and non-string values, unbounded and exponential delegation, and the skip log (house rules 3.1 and 4.2); the remaining classes are closed because anything the rule does not list is not recognized; deliberately unrecognized: launchers and orchestrators (`npx`, `dotenv`, `run-s`, `concurrently`), workspaces and Yarn/pnpm modes; out of scope: the partial-write message in `cli.ts`
- **Resulting writer work**: scripts.ts rewritten from 608 to 89 lines as a closed whitelist (`&&` chains of a Vitest command, `tsc`/`eslint`/`prettier`, or `run`/`test`/colon-name delegation to own string scripts, hooks checked, memoized, 32-script limit, never throws), with the built-in and option tables removed; scripts.test.ts keeps all 204 earlier assertions as table rows (68 changed from true to false, each traced to a contract rule) plus the new cases; detect.ts rejects non-string scripts in the project and template package.json before any write, tested in apply-command.test.ts; execute.ts no longer logs the script body; one docs sentence in README.md, packages/strong-mode/README.md and CLAUDE.md
- **Checkpoint**: locate-by-feature-and-round
- **Decision notes**: after pass 6 the user asked for several passes up front instead of one finding at a time, so critique assurance moved to elevated; after the sweep the user restated the product goal (a wrapper stricter than TypeScript strict, against duplication, dead code and typical AI mistakes), and the full-grammar plan was replaced by this minimal rule; the user decided that Vitest run in another package or from the workspace root is false; contract B's diamond example conflicted with the 32-script limit in A.6, so the writer made the negative diamond end in `eslint .` and added a 24-level Vitest diamond that is true; the orchestrator notes for pass 8 that the preserved rows inflate scripts.test.ts to 1397 lines and that their legacy labels ("detects ... runs Vitest directly") contradict rows that now expect false
