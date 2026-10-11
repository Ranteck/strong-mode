## tsconfig-estricto

### Quality gate

- mode: check-only
- command: npm run typecheck -w strong-mode && npm run lint -w strong-mode && npm run format:check && npm run dead-code
- cwd: /home/denis/Proyectos/strong-mode-tsconfig
- provenance: .github/workflows/ci.yml -> step "Run checks" -> packages/strong-mode/package.json#scripts.check (typecheck && lint && test), split into its mechanical subcommands (test moved to VERIFY); step "Dead code" -> package.json#scripts.dead-code (knip, no --fix); package.json#scripts.format:check (prettier --check), which lefthook runs on pre-commit
- resolution: user-confirmed
- definition sources: .github/workflows/ci.yml, package.json, packages/strong-mode/package.json, lefthook.yml

### Critique assurance

- mode: elevated
- resolution: user-confirmed-trigger
- trigger matches: overwrites user data (explicit user tsconfig.json values)
- trigger evidence: packages/strong-mode/src/apply/merge.ts (planned TEMPLATE_OWNED_PATHS) makes every TYPE_CHECKING_OPTIONS entry overwrite the value the user's tsconfig.json sets (spec T1); the template tsconfig.json change reaches every new project (spec T2)
- lens count: 3
- lens set: correctness-contracts; integration-state-reproducibility; security-abuse-data-loss
- exit challenger: required-before-verify-or-done-rerun-until-clean
- CRITIQUE pass cap: 7 (raised from 5 by the owner on 2026-10-09: pass 6 reviews REFACTOR r05, pass 7 is the exit challenger; no further raise, a valid finding after that means reframing with the owner or a documented gap)
- Codex review/debate call budget: 13

### Backend

- backend: codex
- resolution: default-codex
- resolved session: not-applicable
- disclosure: not-applicable

### Checkpoint commits

- authorized: yes (local commits on feat/strict-tsconfig-merge only; no push, no history rewrite)
- basis: no commit.gpgsign; lefthook pre-commit runs check-only commands (format:check, lint, typecheck); branch checked out, not detached

### Feature contract

#### Current state

Goal: after `npx strong-mode`, an existing project's `tsconfig.json` is as strict as the template's in every TypeScript type-checking option, edited in place so the user's comments and formatting stay, and strong-mode warns which explicit options it raised. Accepted product documents (read them, they are authoritative): `intent/tsconfig-estricto/intent.md`, `intent/tsconfig-estricto/spec.md` (requirements T1-T8), `intent/tsconfig-estricto/plan.md` (a record of what was built, with the requirement -> test table). The root intent `intent/intent.md` records the approved exception: type-checking options take the template's value; everything else keeps the user's.

Requirements:

1. `packages/strong-mode/src/apply/constants.ts` exports `TYPE_CHECKING_OPTIONS: readonly string[]`, exactly TypeScript 5.9's "Type Checking" category in this order: strict, noImplicitAny, strictNullChecks, strictFunctionTypes, strictBindCallApply, strictPropertyInitialization, strictBuiltinIteratorReturn, noImplicitThis, useUnknownInCatchVariables, alwaysStrict, noUnusedLocals, noUnusedParameters, exactOptionalPropertyTypes, noImplicitReturns, noFallthroughCasesInSwitch, noUncheckedIndexedAccess, noImplicitOverride, noPropertyAccessFromIndexSignature, allowUnusedLabels, allowUnreachableCode, plus `noCheck` at the end: it is outside that category, but `noCheck: true` turns type checking off altogether (owner decision, 2026-10-09). A comment says why: TypeScript's own classification plus that one exception; the values live in the template.
2. `packages/scaffold-ultra/template/tsconfig.json` sets all 21: it adds `strictBuiltinIteratorReturn: true`, `allowUnusedLabels: false`, `allowUnreachableCode: false` and `noCheck: false`. Run `npm run sync:template` so `packages/strong-mode/template/` matches. The template's own `src/env.ts` keeps typechecking in a project whose tsconfig sets `"types": []` (the `tsc --init` default since TypeScript 5.9), which drops the automatic `@types/node` globals, without adding Node globals to the project's other files: the type `src/env.ts` needs for `process` stays local to it (spec T8). Its content is exactly the r03 version (`git show 3f911cd:packages/scaffold-ultra/template/src/env.ts`): a module-local `declare const process` and a direct `process.env` read. At runtime it targets Node, as on main; running it where `process` does not exist (a browser bundle) is out of scope, because the root intent puts being a runtime library out of scope; there it throws on import instead of silently using defaults (owner decision, 2026-10-09, replacing the earlier tolerance decision).
3. In the `compilerOptions` of `tsconfig.json`, each TYPE_CHECKING_OPTIONS entry that the template defines takes the template's value even when the project sets it explicitly (spec T1).
4. Everything else merges exactly as today (`mergeJsonValues`): the project's scalars win, arrays are unioned, `extends` is untouched, and the project keeps its own `skipLibCheck`, `verbatimModuleSyntax` and `isolatedModules`. In `tsconfig.eslint.json` the `exclude` stays template-owned, and no type-checking option is forced there (spec T3).
5. tsconfig files are read like tsc reads them, with comments and trailing commas, through `jsonc-parser`, allowing trailing commas; one leading UTF-8 BOM in the project's file is accepted and kept on output. Returns `undefined`, so execute.ts writes conflict markers as today, the conservative path for what strong-mode cannot edit safely (spec T4): a syntax error, a non-object root, a `compilerOptions` that exists but is not a plain object, any object with a duplicate key, or any key named `__proto__`. After editing, the written text is parsed again and must equal the computed merge; otherwise the result is `undefined` too, so what is reported is what is written.
6. The merged file is produced by editing the original text (`modify` + `applyEdits`) only where the target differs: the user's comments, key order, trailing commas and line endings stay; inserted content uses 2-space indentation (spec T5). A unioned array keeps the project's elements exactly as written (no deduplication of them). Whenever the merged array starts with the project's array, only the remaining elements are appended by array insertion; any other changed array (for example a template-owned `exclude` of `tsconfig.eslint.json` that differs from the project's) is replaced as a whole. Ownership rule (owner decision, 2026-10-09, from the root intent's exception): a value strong-mode owns (a TYPE_CHECKING_OPTIONS entry in `tsconfig.json`, `exclude` in `tsconfig.eslint.json`) that differs from the project's is replaced as a whole, comments inside it included, except the append case above. Nothing outside an owned value is ever replaced (the project's scalars win and unioned arrays only append), so no other comment is deleted. Accepted limitation (owner decision, 2026-10-09): a comment on the same line after the last entry of an object or array can end up after the entries strong-mode inserts, and inserting can re-indent or re-space the neighbouring line.
7. `merge.ts` exports `interface RaisedOption { readonly name: string; readonly from: unknown; readonly to: unknown }` and `interface MergeResult { readonly content: string; readonly raisedOptions: readonly RaisedOption[] }`; `mergeManagedFileContent(relativePath, existingContent, incomingContent)` returns `MergeResult | undefined`. `raisedOptions` lists, in TYPE_CHECKING_OPTIONS order, only the options the project set explicitly with a value different from the merged one; `.gitignore` and `.prettierignore` return `raisedOptions: []`.
8. `execute.ts` (`applyConflictingFile`) uses `MergeResult`; when a tsconfig merge returns `undefined` it warns, once per file, that the file could not be merged safely and got conflict markers instead (the root intent: be conservative and explain why); no other behavior change, and after a merged write calls `log.warn` once per file with raised options, exact text: `<file>: raised <name> (<from> → <to>), ... to the strong-mode values. Type errors they reveal in your code are expected; fix the code rather than lowering the options.` where from/to are `JSON.stringify` values and items are joined with ", ". With `--dry-run` the verb is `would raise` and nothing is written (spec T6).
9. New runtime dependency: `jsonc-parser@^3.3.1` in `packages/strong-mode/package.json` `dependencies` (lockfile updated). No other new dependency. Its ESM build does not load in Node; the CommonJS entry with named imports does, and tsup keeps it external.
10. Docs (all approved by the owner on 2026-10-09):
    - Root `README.md` "What it installs -> TypeScript" describes the merge with the ownership rule of item 6 in terms a user can act on: comments are kept, a comment next to a type-checking option stays when the option is raised, and the only comments deleted are those inside a value strong-mode owns and replaces as a whole, which in a valid tsconfig is a replaced `exclude` array in `tsconfig.eslint.json`. "Roadmap / Known limitations" gets one line: the template's `src/env.ts` targets Node (it reads `process.env`; in a bundle without `process` it throws on import). Then `npm run sync:template`, which copies the README to `packages/strong-mode/README.md`.
    - `CLAUDE.md` describes the merge with the same ownership wording, kept short (it loads in every session). It names `TYPE_CHECKING_OPTIONS`, like the other constants it points to, and the note that the template `src/env.ts` targets Node sits with the managed files list, not under the tsconfig editing limitations.
    - `intent/tsconfig-estricto/intent.md` (edited by Claude with the owner's OK of 2026-10-10; do not rewrite it):
      - its body names the template `src/env.ts` under "Usuarios y sistemas afectados" (it compiles with the project's `types`) and under "Fuera de alcance" (running without `process`);
      - `## Cambios` has a single 2026-10-09 entry with the three final decisions: `noCheck: false`, the ownership rule with the accepted comment limitation, and `src/env.ts` Node-only;
      - its `Fecha` is 2026-10-09, the date of that entry, as in the root chain. It has 527 words, over the skill's 400; the owner chose on 2026-10-10 to leave it, because trimming would rewrite his accepted text.
    - `intent/tsconfig-estricto/spec.md` (edited by Claude with the owner's OK of 2026-10-10; do not rewrite it):
      - its header cites the intent of 2026-10-09, and every row states MUST;
      - T4 states everything item 5 says: the BOM is kept, and a syntax error, a non-object root or `compilerOptions`, duplicate keys, a `__proto__` key or a written text that does not parse back to the computed merge get conflict markers and a warning;
      - T5 states the ownership rule;
      - T8 says that the template `src/env.ts` typechecks under `types: []`, with the template `lib` and with DOM, without adding Node globals to the project's other files (Intent: those two lines of the feature intent, root REQ-8; Tests: `constants.test.ts`);
      - the Diseño section matches the code: one read with `jsonc-parser`, the BOM, the array append, the re-read of the edited text, the fallback warning, and one line on `src/env.ts`.
    - `intent/tsconfig-estricto/plan.md` (rewritten by Claude with the owner's OK of 2026-10-10; do not rewrite it) follows the skill's plan format: at most 750 words and no code blocks; its header cites spec.md 2026-10-10 and intent.md 2026-10-09; it lists the files, the requirement -> test table for T1-T8, the work done and what is left to close, the risks and how it is verified. It stays `Estado: aceptado`, records facts and adds no scope.
    - Root `intent/spec.md` has no `noCheck` concern.
    - Root `intent/plan.md`:
      - step 1 drops the stale `3f911cd` and lists the final decisions: the comment limitation with the ownership rule, `noCheck: false`, and `src/env.ts` Node-only;
      - step 4 gains the gap that nothing checks the minimum TypeScript version the template needs: its `lib: ["ES2024"]` needs TypeScript 5.7, and `noCheck` and `strictBuiltinIteratorReturn` need 5.6;
      - it stays at most 750 words, counting words that contain a letter or digit;
      - when the feature closes, REQ-2's row becomes `cubre` and step 1 is removed (Claude does this at closure, not in this round).
    - Docs must not claim more than the code and tests do.

Tests (TDD: write each failing test first): `constants.test.ts` (the template sets every TYPE_CHECKING_OPTIONS entry as a boolean; `ts.parseJsonConfigFileContent` with all of them set and `files: ["index.ts"]` reports no errors); `merge.test.ts` (explicit lax options raised and listed; non-type-checking options, extends and skipLibCheck kept; a commented tsc-init-style file with trailing commas and CRLF edited in place; a non-object compilerOptions returns undefined; existing tests keep their assertions, reading `result?.content`); `execute.test.ts` (the warning, with and without dry-run, each `it.each` row with a unique title). `merge.test.ts` also pins the ownership rule: a project `"noCheck": { /* reason */ "enabled": true }` becomes `false`, a comment outside template-owned values stays, and `raisedOptions` lists `noCheck`. For the template `src/env.ts` (spec T8):

- with the template's own `lib` and with `DOM`, under `types: []`, it has no diagnostics;
- a sibling file that reads `process` still gets TS2591, so the declaration stays local; source files are matched by normalized paths, so the check also holds on Windows;
- the template declares `zod`, and the repository's `zod` satisfies that range; the test fails if the template stops declaring `zod`.

No test executes `src/env.ts` without `process`: that behavior was reverted by the owner's decision of item 2, so its r04 test goes with it. Assertions pin observable behavior, not list order (no `.at(-1)`), without redundant ones, and all go through Vitest (no `node:assert`). Test fixtures need no elevated privileges on Windows (no `"dir"` symlinks).

Constraints: strong-mode's own code stays small, without duplication or dead code; comments explain why, not what; English CLI messages; match the surrounding code style (explicit return types); never weaken an existing test; no changes to prompts, install or check flow.

Out of scope: running Prettier on merged files (the root spec's formatting concern); a project's own `tsconfig.eslint.json` or solution-style tsconfigs (root plan step 3); forcing `skipLibCheck`, `verbatimModuleSyntax` or `isolatedModules`; a gate that detects options being lowered later.

#### Round log

##### IMPL-r00

- **Actors/backend**: orchestrator Claude (SPEC, contract, quality gate, commit); writer Codex via codex:codex-rescue with --write and --cwd /home/denis/Proyectos/strong-mode-tsconfig; backend codex
- **CRITIQUE outcome**: not applicable
- **DEBATE classifications**: not applicable
- **Resulting writer work**: plan tasks 1-4: `TYPE_CHECKING_OPTIONS` and the three new template options (synced); `merge.ts` reads tsconfig files as JSONC with jsonc-parser, applies template-owned paths, edits the text in place and returns `MergeResult` with `raisedOptions`; `execute.ts` warns the raised options (`would raise` in dry-run); `jsonc-parser@^3.3.1` dependency; README, CLAUDE.md, `intent/spec.md` and `intent/plan.md` updated. Codex also edited the accepted `intent/tsconfig-estricto/plan.md` (checkboxes, plus an unrequested "Adaptaciones" paragraph and reworded task 4 steps), left for CRITIQUE/DEBATE.
- **Checkpoint**: locate-by-feature-and-round
- **Decision notes**: SPEC wrote the contract from the accepted feature intent, spec and plan (2026-10-07). The first IMPL attempt ran in the main checkout's workspace (no `--cwd`) and wrote nothing; the second stopped at task 2 because Codex's sandbox has no network. With the user's OK, Claude pre-downloaded jsonc-parser@3.3.1 (sha512 checked against the registry) into a scratchpad npm cache and Codex installed it with `--offline`. The user approved one checkpoint per round instead of one commit per task. Quality gate passed (exit 0, no snapshot delta).

##### REFACTOR-r01

- **Actors/backend**: orchestrator Claude (fan-in, triage, contract update, quality gate, commit); reviewers Codex: 3 fresh read-only lenses (correctness-contracts, integration-state-reproducibility, security-abuse-data-loss) plus a fresh canonicalization; a parallel Claude `/code-review` at high effort (not a lens); writer Codex in a fresh write session (the read-only canonical thread cannot be upgraded to write), resumed once for a gate fix; backend codex
- **CRITIQUE outcome**: CRITIQUE pass 1 (elevated sweep plus canonicalization) on 4fc9ab0, artifact `c728bb01906a10726339f811ad0d285dd3375d0cb0c92eedf8ef7d7e1f945052`: 15 normalized findings (F1-F15). P1: duplicate keys. P2: changed arrays deleting comments, comments re-associated with inserted keys, neighbouring lines re-indented, UTF-8 BOM rejected, `__proto__` keys fabricating raised options.
- **DEBATE classifications**: valid and fixed: F1 duplicate keys (conservative `undefined` plus verification of the written text), F2 arrays (append-only union that keeps the project's elements), F5 BOM, F6 `__proto__`, F9 execute cleanup, F13 and F15 docs accuracy; F14 partly valid (the accepted feature plan restored to its 791b173 text, ticks kept). Valid against T5 but escalated to the owner, not fixed: F3 comment association and F4 neighbour re-indentation and fixed 2-space insertion; a full fix needs a custom JSONC editor, which conflicts with the small-code constraint. Contract limitation, proposed concern for the owner: F12 `noCheck` (C16). Accepted design or no defect: F7 (C15), F8 (T6 lists explicit options only), F10, F11.
- **Resulting writer work**: `merge.ts` rejects duplicate keys and `__proto__` keys, checks that the written text parses back to the computed merge, strips and restores a leading BOM, and unions arrays by appending only the missing template elements in place; `execute.ts` evaluates the merge decision once; 18 new tests; README, CLAUDE.md, `intent/spec.md` and `intent/plan.md` describe what is preserved and its limitations, with C16 proposed; the feature plan text restored. The gate failed once (Prettier on `intent/spec.md`) and passed after the fix in the same activation.
- **Checkpoint**: locate-by-feature-and-round
- **Decision notes**: Claude refined contract item 5 (duplicate keys, `__proto__`, BOM, output verification) and item 6 (array semantics), both in the conservative direction of the root intent's out-of-scope rule. The canonicalizer argued that documentation cannot close F3/F4 under T5; agreed: only an owner-approved amendment of T5 or a redesign can, so the cycle pauses for the owner after this round's review. The artifact-identity recipe ran without its `rm` trap, which a safety check blocked, using a fixed scratchpad temp file; the hashed byte stream is unchanged. Review budget used: 4 of 13.

##### REFACTOR-r02

- **Actors/backend**: orchestrator Claude (end-to-end probe, triage, contract update, quality gate, commit); reviewer Codex resumed read-only on the r01 writer thread with an inline continuity summary; a parallel Claude `/code-review` at high effort (not a lens); writer Codex resumed with `--write` on the same thread; backend codex
- **CRITIQUE outcome**: CRITIQUE pass 2 on c8bfec9: Codex found no new defects (128 adversarial key and BOM cases, corrupted-edit verification, execute transitions; no F3/F4 re-report). The parallel `/code-review` found no correctness bug and raised CR1-CR6. Claude's end-to-end apply on a real `tsc --init` project (TypeScript 5.9) showed F16: the post-apply typecheck failed inside the template's own `src/env.ts` (`TS2591: Cannot find name 'process'`), because `tsc --init` now writes `"types": []` and the merge keeps it.
- **DEBATE classifications**: valid and fixed: F16 (a `/// <reference types="node" />` in the template `src/env.ts`; an explicit `node:process` import failed with TS2307), CR1 (explain the conservative fallback, as the root intent requires), CR2 (choose append or replace from the data instead of threading owned paths), CR3 (dead branch in execute.ts), CR4 (no BOM handling for the bundled template, a case that cannot occur), CR5 (`parseTree` single pass, smaller). No defect: CR6 (one `modify` per appended element; negligible cost, output verified). F3/F4 stay escalated to the owner; C16 stays proposed.
- **Resulting writer work**: template `src/env.ts` gains the Node types reference with its why comment (synced); `execute.ts` warns when a tsconfig could not be merged safely and got conflict markers, and drops the unreachable branch; `merge.ts` decides array append from the data, reads each text once with `parseTree`, and handles a BOM only on the project's file; tests for F16 (TypeScript program with `types: []`) and the fallback warning, the incoming-BOM test removed with its code path; docs updated.
- **Checkpoint**: locate-by-feature-and-round
- **Decision notes**: Claude added the `"types": []` requirement to contract item 2 and the fallback warning to item 8. With the reference applied, the probe project passes typecheck, lint and test; its `check` still fails only on `format:check` of the merged `tsconfig.json`, which is C14, outside this feature. Review budget used: 5 of 13; CRITIQUE passes: 2 of 5.

##### REFACTOR-r03

- **Actors/backend**: orchestrator Claude (triage, local probe of the F17 fix, contract update, quality gate, commit); reviewer Codex resumed read-only on the writer thread; a parallel Claude `/code-review` at high effort (not a lens); writer Codex resumed with `--write`; backend codex
- **CRITIQUE outcome**: CRITIQUE pass 3 on 370ded3: Codex found F17 (P2): the F16 `/// <reference types="node" />` adds Node globals to the whole program, so in a `types: []` + DOM project `const timer: number = setTimeout(...)` fails with TS2322. No other new defect (128 adversarial merge cases, corrupted edits rejected, template passes typecheck, ESLint, knip and its tests with `types: []`). The parallel `/code-review` corroborated F17 and raised a stale contract (items 5 and 6), a missing test for append on a template-owned array, a weak F16 test (one diagnostic code), no guard that the template has no BOM, a duplicated conflict path in execute.ts, a stale merge.ts comment, the generic fallback reason, and an unreachable `isPlainObject` check.
- **DEBATE classifications**: valid and fixed: F17 (a `process` declaration local to the template `src/env.ts`; Claude probed it in a real tsc --init project with `"types": []` and with automatic @types/node: tsc, ESLint, Prettier and tests pass, no redeclaration error), the stale contract (fixed by Claude), the append test, the zero-diagnostics F16/F17 test, the template BOM guard, the single conflict path, the stale comment. Not changed: the fallback warning names the possible causes (an exact cause would need a failure type in the interface for little user value); `isPlainObject` after `node.type === "object"` narrows the type without an assertion. F3/F4 stay escalated; C16 stays proposed.
- **Resulting writer work**: template `src/env.ts` replaces the reference directive with a module-local `process` declaration and its why comment (synced); `execute.ts` routes an unmergeable tsconfig through the shared conflict path after warning; `merge.ts` comment updated; tests: zero diagnostics for the template `src/env.ts` plus a DOM timer file under `types: []`, append on a template-owned `exclude` keeping its comment, template tsconfigs without BOM; 295 tests.
- **Checkpoint**: locate-by-feature-and-round
- **Decision notes**: Claude updated contract items 2 (the type for `process` stays local to `src/env.ts`), 5 (no parser function named; BOM only in the project's file) and 6 (append whenever the merged array starts with the project's). Review budget used: 6 of 13; CRITIQUE passes: 3 of 5.

##### REFACTOR-r04

- **Actors/backend**: orchestrator Claude (triage, contract update with the owner's decisions, quality gate, commit); reviewer Codex in a fresh read-only session (`--resume-last` was refused: a task interrupted by the machine shutdown is still marked running); writer Codex in a fresh write session with an inline continuity summary; backend codex
- **CRITIQUE outcome**: CRITIQUE pass 4 on 179ef05 (r03 plus the merge of main's rewritten SDLC docs): no production defect; three P2 test gaps in the F17 test (a `"dir"` symlink that needs privileges on Windows, no proof that the `process` declaration stays local, only a DOM `lib` exercised). It confirmed the browser runtime concern. The earlier `/code-review` of r03 raised the same test gaps plus the repository-vs-template zod version, the reassigned `decision` in execute.ts, and duplicate `it.each` titles.
- **DEBATE classifications**: all valid and fixed. The owner decided three questions on 2026-10-09: accept the comment limitation (F3/F4) as documented, force `noCheck` to `false`, and make the template `src/env.ts` tolerate a missing `process`.
- **Resulting writer work**: `TYPE_CHECKING_OPTIONS` gains `noCheck` and the template sets `noCheck: false` (synced); the template `src/env.ts` types `process` as possibly undefined and reads it through `typeof`, so a browser gets the schema defaults; tests: no diagnostics with the template `lib` and with DOM under `types: []`, a sibling file reading `process` still gets TS2591, the repository zod satisfies the template range, `env.ts` executed without `process` yields the defaults, no `"dir"` symlinks; execute.ts computes `mergeFailed` once; unique `it.each` titles; feature intent (2026-10-09 `## Cambios` entry) and spec T1/T2/T5, root spec (the `noCheck` concern removed), root plan step 1, README and CLAUDE.md updated; 298 tests.
- **Checkpoint**: locate-by-feature-and-round
- **Decision notes**: Claude updated contract items 1, 2, 6, 10 and the tests line with the owner's decisions. Correction to the REFACTOR-r03 note: execute.ts warns about an unsafe merge after writing the conflict markers, not before. The merge commit 179ef05 (main into the branch, not a rebase) sits between r03 and r04 and changes only docs. Review budget: CRITIQUE passes 4 of 5.

##### REFACTOR-r05

- **Actors/backend**: orchestrator Claude (triage against the intent, contract update, SDLC doc corrections, quality gate, commit); reviewer Codex in a fresh read-only session (`--resume-last` still refused); a parallel Claude `/code-review` at high effort (not a lens); writer Codex in a fresh write session fed through `--prompt-file`; backend codex
- **CRITIQUE outcome**: CRITIQUE pass 5 on e1b1182 found:
  - P1: the r04 `typeof process` read in the template `src/env.ts` drops a generated project's branch coverage to 75% (threshold 85%); the parallel `/code-review` added that it breaks the template's own ESLint (`unicorn/no-typeof-undefined`) and that a browser bundle silently gets `NODE_ENV: "development"`;
  - P2: a comment inside an object value of `noCheck` is deleted when the value becomes `false`;
  - P3: the feature plan still described 20 options and a pending `noCheck` step;
  - `/code-review` only: a `?? ""` fallback in the zod-range test, a path comparison that fails on Windows, redundant assertions, an `.at(-1)` order pin, a stale `3f911cd` in the root plan, no spec row for `src/env.ts`, and the TypeScript 5.6 floor of `noCheck` and `strictBuiltinIteratorReturn`.
- **DEBATE classifications**: the owner asked to go back to the intent instead of deciding case by case, and approved the result on 2026-10-09:
  - P1 valid, fixed by reverting the tolerance decision: the root intent puts being a runtime library out of scope, and the feature only needs `src/env.ts` to compile under the project's `types` (spec T8), which r03 already did;
  - P2 not a defect: the root intent's exception gives type-checking options to the template, and the code replaces whole only template-owned values, so the contract now states the ownership rule instead of "comments are never deleted"; a test pins it;
  - P3 and the test and doc items valid and fixed;
  - the TypeScript floor is not new to this feature (main's template `lib: ["ES2024"]` already needs 5.7): recorded as a gap in root plan step 4.
- **Resulting writer work**: template `src/env.ts` restored byte for byte to r03 (synced); `constants.test.ts` loses the run-without-`process` test and the order pin, asserts that the template declares `zod`, and compares normalized paths; `merge.test.ts` pins the ownership rule; README and CLAUDE.md state the ownership rule and that the template `src/env.ts` targets Node; feature spec with MUST in every row, T5 by ownership and the new T8; root plan step 1 and the TypeScript-floor gap (742 words); 298 tests. Codex also rewrote the accepted feature plan as a record of what was built, without the old reference code.
- **Checkpoint**: locate-by-feature-and-round
- **Decision notes**:
  - Contract: Claude updated items 2, 6 and 10 and the tests line. The owner raised the CRITIQUE pass cap from 5 to 7, with no further raise.
  - Process deviation in pass 5: its prompt summarized the contract instead of carrying the byte-exact fence. From this round on the task text goes through `--prompt-file`.
  - Dispatch: the wrapper agent of this round died on a session limit after dispatching; the Codex task itself completed, and Claude read its result from the companion.
  - Owner decisions of 2026-10-10 on the SDLC docs, applied by Claude: the feature intent names `src/env.ts` in its body and keeps one 2026-10-09 `## Cambios` entry; T8 cites those lines; the rewritten feature plan is accepted, back to `Estado: aceptado` and without round-only sentences.
  - Review budget used: 8 of 13; CRITIQUE passes: 5 of 7.

##### REFACTOR-r06

- **Actors/backend**: orchestrator Claude (triage, contract update, SDLC doc edits with the owner's OK, quality gate, commit); reviewer Codex in a fresh read-only session fed through `--prompt-file`; a parallel Claude `/code-review` at high effort (not a lens); writer Codex in a fresh write session; backend codex
- **CRITIQUE outcome**: CRITIQUE pass 6 on 9ac815d: Codex reported no valid findings (both copies of `src/env.ts` identical to 3f911cd; the template typechecks and lints under `types: []`, with automatic Node globals and with DOM; a missing root file still fails with TS6053; 126 extra probes kept every comment outside owned values). It could not install a generated project inside its sandbox, which VERIFY covers. The parallel `/code-review` found no correctness bug and eight hygiene items: a stale line in the contract's goal, a spec T4 and Diseño that state less than the code, intent and spec dates not bumped, an ownership sentence in the README that reads as if a comment next to a raised option were deleted, two TypeScript programs per `src/env.ts` test case, a `node:assert` import in a Vitest file, the placement of the `src/env.ts` note and a dropped `TYPE_CHECKING_OPTIONS` mention in CLAUDE.md, and feature docs over the skill's word limits.
- **DEBATE classifications**:
  - valid and fixed by Codex: the README and CLAUDE.md wording, the CLAUDE.md pointer and note placement, the `node:assert` import;
  - valid and fixed by Claude with the owner's OK of 2026-10-10: the contract's goal line, spec T4 and Diseño, the dates, and the feature plan rewritten in the skill's format (560 words, no code);
  - not changed: the two programs per case cost about a second and keep the two claims of spec T8 as separate assertions;
  - owner decision: the feature intent stays at 527 words.
- **Resulting writer work**: README (synced) and CLAUDE.md say that comments are kept, also next to a raised option, and that the only ones deleted sit inside a template-owned value replaced as a whole, which in a valid tsconfig is a replaced `exclude` of `tsconfig.eslint.json`; CLAUDE.md names `TYPE_CHECKING_OPTIONS` again and carries the `src/env.ts` note with the managed files list; `constants.test.ts` uses Vitest's `assert`; 298 tests.
- **Checkpoint**: locate-by-feature-and-round
- **Decision notes**:
  - Process deviation, disclosed to the owner: after this round the cycle goes straight to the exit challenger as pass 7 instead of a resumed review first. The cap stays at 7 by the owner's commitment, and the exit challenger reads the whole final artifact cold.
  - Review budget used: 9 of 13; CRITIQUE passes: 6 of 7.

##### CRITIQUE-r07-noop

- **Actors/backend**: orchestrator Claude (exit challenger dispatch, VERIFY, closure docs, commit); reviewer Codex as a fresh read-only exit challenger fed through `--prompt-file`, without the prior finding ledger; backend codex
- **CRITIQUE outcome**: CRITIQUE pass 7 (exit challenger) on 31ce3e5, artifact `f314705a9eee6220a302c5c4a7d1a5a9b234a6a30f842b46a46096971b615446`: no valid findings against the contract. It challenged the ownership rule, comment preservation, array appends, the unsafe-input fallback, the warning text and the local `process` declaration (16 merge variants, 12 invalid inputs, 16 execution scenarios, a virtual TypeScript compilation for T8). Its read-only sandbox ran no Vitest tests, no build and no real apply, which VERIFY covers.
- **DEBATE classifications**: no valid findings; the exit gate is satisfied on 31ce3e5.
- **Resulting writer work**: none
- **Checkpoint**: none
- **Decision notes**:
  - VERIFY on 31ce3e5, run by Claude on 2026-10-10: `npm run check` (298 tests), build, the `--dry-run --yes` smoke run and `npm run dead-code` exit 0, and the template copy is in sync.
  - Real apply (spec T7) on an `npm init` plus `tsc --init` project with `"strict": false`: the warning `tsconfig.json: raised strict (false → true)` came out, the 20 comment lines stayed identical, there were no conflict markers, `"types": []` was kept, and the project's typecheck, lint, test and coverage exit 0. `npm init -y` now writes `"type": "commonjs"`, which strong-mode rejected before writing, as designed; the project was switched to ESM first.
  - `/e2e-pm-matrix`: npm 10, npm 11 and pnpm pass `scaffold` and `lockstep-tag`. Yarn 1 and bun fail on the type-aware lint crash that the README lists as a known limitation (a nested TypeScript 7 under `eslint-plugin-sonarjs`); `tsc --noEmit` passed before the crash. An extra fixture with a commented `tsc --init` tsconfig passes apply, typecheck, lint and test on npm and pnpm, and its `check` fails only on `format:check` of the merged file, the root spec's formatting concern, out of scope here.
  - Closure docs by Claude, as contract item 10 foresaw: the root plan marks REQ-2 as `cubre`, drops step 1 and renumbers the rest; the feature intent and spec now name that step instead of its number; the feature plan records the verification results.
  - Review budget used: 10 of 13; CRITIQUE passes: 7 of 7.
