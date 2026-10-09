# PROJECT_CONTEXT

## vitest-command-detection — closed whitelist decides whether to add the Vitest-only env test, with a declared-runner veto; completed 2026-10-06; archive: `PROJECT_CONTEXT.archive/vitest-command-detection.md`; archive-sha256: `fc25907d7c4961e8c325f0d1d06cfec7e85557b4d4c070d96369c1c1b687a769`; finished-work checkpoint: `d69bcc5`

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
- CRITIQUE pass cap: 5
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

Goal: after `npx strong-mode`, an existing project's `tsconfig.json` is as strict as the template's in every TypeScript type-checking option, edited in place so the user's comments and formatting stay, and strong-mode warns which explicit options it raised. Accepted product documents (read them, they are authoritative): `intent/tsconfig-estricto/intent.md`, `intent/tsconfig-estricto/spec.md` (requirements T1-T7), `intent/tsconfig-estricto/plan.md` (tasks 1-4 with reference code; adapt it if it is wrong, but keep the interfaces below). The root intent `intent/intent.md` records the approved exception: type-checking options take the template's value; everything else keeps the user's.

Requirements:

1. `packages/strong-mode/src/apply/constants.ts` exports `TYPE_CHECKING_OPTIONS: readonly string[]`, exactly TypeScript 5.9's "Type Checking" category in this order: strict, noImplicitAny, strictNullChecks, strictFunctionTypes, strictBindCallApply, strictPropertyInitialization, strictBuiltinIteratorReturn, noImplicitThis, useUnknownInCatchVariables, alwaysStrict, noUnusedLocals, noUnusedParameters, exactOptionalPropertyTypes, noImplicitReturns, noFallthroughCasesInSwitch, noUncheckedIndexedAccess, noImplicitOverride, noPropertyAccessFromIndexSignature, allowUnusedLabels, allowUnreachableCode. A comment says why: TypeScript's own classification; the values live in the template.
2. `packages/scaffold-ultra/template/tsconfig.json` sets all 20: it adds `strictBuiltinIteratorReturn: true`, `allowUnusedLabels: false` and `allowUnreachableCode: false`. Run `npm run sync:template` so `packages/strong-mode/template/` matches. The template's own `src/env.ts` keeps typechecking in a project whose tsconfig sets `"types": []` (the `tsc --init` default since TypeScript 5.9), which drops the automatic `@types/node` globals, without adding Node globals to the project's other files: the type `src/env.ts` needs for `process` stays local to it.
3. In the `compilerOptions` of `tsconfig.json`, each TYPE_CHECKING_OPTIONS entry that the template defines takes the template's value even when the project sets it explicitly (spec T1).
4. Everything else merges exactly as today (`mergeJsonValues`): the project's scalars win, arrays are unioned, `extends` is untouched, and the project keeps its own `skipLibCheck`, `verbatimModuleSyntax` and `isolatedModules`. In `tsconfig.eslint.json` the `exclude` stays template-owned, and no type-checking option is forced there (spec T3).
5. tsconfig files are read like tsc reads them, with comments and trailing commas, through `jsonc-parser`, allowing trailing commas; one leading UTF-8 BOM in the project's file is accepted and kept on output. Returns `undefined`, so execute.ts writes conflict markers as today, the conservative path for what strong-mode cannot edit safely (spec T4): a syntax error, a non-object root, a `compilerOptions` that exists but is not a plain object, any object with a duplicate key, or any key named `__proto__`. After editing, the written text is parsed again and must equal the computed merge; otherwise the result is `undefined` too, so what is reported is what is written.
6. The merged file is produced by editing the original text (`modify` + `applyEdits`) only where the target differs: the user's comments, key order, trailing commas and line endings stay; inserted content uses 2-space indentation (spec T5). A unioned array keeps the project's elements exactly as written (no deduplication of them). Whenever the merged array starts with the project's array, only the remaining elements are appended by array insertion; any other changed array (for example a template-owned `exclude` of `tsconfig.eslint.json` that differs from the project's) is replaced as a whole.
7. `merge.ts` exports `interface RaisedOption { readonly name: string; readonly from: unknown; readonly to: unknown }` and `interface MergeResult { readonly content: string; readonly raisedOptions: readonly RaisedOption[] }`; `mergeManagedFileContent(relativePath, existingContent, incomingContent)` returns `MergeResult | undefined`. `raisedOptions` lists, in TYPE_CHECKING_OPTIONS order, only the options the project set explicitly with a value different from the merged one; `.gitignore` and `.prettierignore` return `raisedOptions: []`.
8. `execute.ts` (`applyConflictingFile`) uses `MergeResult`; when a tsconfig merge returns `undefined` it warns, once per file, that the file could not be merged safely and got conflict markers instead (the root intent: be conservative and explain why); no other behavior change, and after a merged write calls `log.warn` once per file with raised options, exact text: `<file>: raised <name> (<from> → <to>), ... to the strong-mode values. Type errors they reveal in your code are expected; fix the code rather than lowering the options.` where from/to are `JSON.stringify` values and items are joined with ", ". With `--dry-run` the verb is `would raise` and nothing is written (spec T6).
9. New runtime dependency: `jsonc-parser@^3.3.1` in `packages/strong-mode/package.json` `dependencies` (lockfile updated). No other new dependency. Its ESM build does not load in Node; the CommonJS entry with named imports does, and tsup keeps it external.
10. Docs: root `README.md` "What it installs -> TypeScript" describes the new behavior (then `npm run sync:template`, which copies it to `packages/strong-mode/README.md`); `CLAUDE.md` describes the merge (JSONC via jsonc-parser, edited in place, TYPE_CHECKING_OPTIONS template-owned, raised options warned); root `intent/plan.md`: when the feature closes, REQ-2's row becomes `cubre` and work-order step 1 is removed; root `intent/spec.md` keeps its `noCheck` concern open. Docs must not claim more than the code and tests do.

Tests (TDD: write each failing test first): `constants.test.ts` (the template sets every TYPE_CHECKING_OPTIONS entry as a boolean; `ts.parseJsonConfigFileContent` with all 20 set and `files: ["index.ts"]` reports no errors); `merge.test.ts` (explicit lax options raised and listed; non-type-checking options, extends and skipLibCheck kept; a commented tsc-init-style file with trailing commas and CRLF edited in place; a non-object compilerOptions returns undefined; existing tests keep their assertions, reading `result?.content`); `execute.test.ts` (the warning, with and without dry-run).

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
