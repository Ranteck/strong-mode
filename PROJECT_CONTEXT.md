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
2. `packages/scaffold-ultra/template/tsconfig.json` sets all 20: it adds `strictBuiltinIteratorReturn: true`, `allowUnusedLabels: false` and `allowUnreachableCode: false`. Run `npm run sync:template` so `packages/strong-mode/template/` matches.
3. In the `compilerOptions` of `tsconfig.json`, each TYPE_CHECKING_OPTIONS entry that the template defines takes the template's value even when the project sets it explicitly (spec T1).
4. Everything else merges exactly as today (`mergeJsonValues`): the project's scalars win, arrays are unioned, `extends` is untouched, and the project keeps its own `skipLibCheck`, `verbatimModuleSyntax` and `isolatedModules`. In `tsconfig.eslint.json` the `exclude` stays template-owned, and no type-checking option is forced there (spec T3).
5. tsconfig files are read like tsc reads them, with comments and trailing commas, through `jsonc-parser` (`parse` with `allowTrailingComma: true`). A syntax error, a non-object root, or a `compilerOptions` that exists but is not a plain object returns `undefined`, so execute.ts writes conflict markers as today (spec T4).
6. The merged file is produced by editing the original text (`modify` + `applyEdits`) only where the target differs: the user's comments, key order, trailing commas and line endings stay; inserted content uses 2-space indentation (spec T5).
7. `merge.ts` exports `interface RaisedOption { readonly name: string; readonly from: unknown; readonly to: unknown }` and `interface MergeResult { readonly content: string; readonly raisedOptions: readonly RaisedOption[] }`; `mergeManagedFileContent(relativePath, existingContent, incomingContent)` returns `MergeResult | undefined`. `raisedOptions` lists, in TYPE_CHECKING_OPTIONS order, only the options the project set explicitly with a value different from the merged one; `.gitignore` and `.prettierignore` return `raisedOptions: []`.
8. `execute.ts` (`applyConflictingFile`) uses `MergeResult` without other behavior change, and after a merged write calls `log.warn` once per file with raised options, exact text: `<file>: raised <name> (<from> → <to>), ... to the strong-mode values. Type errors they reveal in your code are expected; fix the code rather than lowering the options.` where from/to are `JSON.stringify` values and items are joined with ", ". With `--dry-run` the verb is `would raise` and nothing is written (spec T6).
9. New runtime dependency: `jsonc-parser@^3.3.1` in `packages/strong-mode/package.json` `dependencies` (lockfile updated). No other new dependency. Its ESM build does not load in Node; the CommonJS entry with named imports does, and tsup keeps it external.
10. Docs: root `README.md` "What it installs -> TypeScript" describes the new behavior (then `npm run sync:template`, which copies it to `packages/strong-mode/README.md`); `CLAUDE.md` describes the merge (JSONC via jsonc-parser, edited in place, TYPE_CHECKING_OPTIONS template-owned, raised options warned); `intent/spec.md`: R2 becomes `verificado`, C10 resolved, and new concerns C14 (merged files do not pass `prettier --check`, already true on main) and C15 (a project's own lax `tsconfig.eslint.json`; solution-style tsconfigs with `references`, where the root's strictness does not reach `tsconfig.app.json`, together with C11); `intent/plan.md`: this work under Hecho, C10 removed from the order, C14 with the gates step, C15 with C11. Docs must not claim more than the code and tests do.

Tests (TDD: write each failing test first): `constants.test.ts` (the template sets every TYPE_CHECKING_OPTIONS entry as a boolean; `ts.parseJsonConfigFileContent` with all 20 set and `files: ["index.ts"]` reports no errors); `merge.test.ts` (explicit lax options raised and listed; non-type-checking options, extends and skipLibCheck kept; a commented tsc-init-style file with trailing commas and CRLF edited in place; a non-object compilerOptions returns undefined; existing tests keep their assertions, reading `result?.content`); `execute.test.ts` (the warning, with and without dry-run).

Constraints: strong-mode's own code stays small, without duplication or dead code; comments explain why, not what; English CLI messages; match the surrounding code style (explicit return types); never weaken an existing test; no changes to prompts, install or check flow.

Out of scope: running Prettier on merged files (C14); a project's own `tsconfig.eslint.json` or solution-style tsconfigs (C15); forcing `skipLibCheck`, `verbatimModuleSyntax` or `isolatedModules`; a gate that detects options being lowered later.

#### Round log

##### IMPL-r00

- **Actors/backend**: orchestrator Claude (SPEC, contract, quality gate, commit); writer Codex via codex:codex-rescue with --write and --cwd /home/denis/Proyectos/strong-mode-tsconfig; backend codex
- **CRITIQUE outcome**: not applicable
- **DEBATE classifications**: not applicable
- **Resulting writer work**: plan tasks 1-4: `TYPE_CHECKING_OPTIONS` and the three new template options (synced); `merge.ts` reads tsconfig files as JSONC with jsonc-parser, applies template-owned paths, edits the text in place and returns `MergeResult` with `raisedOptions`; `execute.ts` warns the raised options (`would raise` in dry-run); `jsonc-parser@^3.3.1` dependency; README, CLAUDE.md, `intent/spec.md` and `intent/plan.md` updated. Codex also edited the accepted `intent/tsconfig-estricto/plan.md` (checkboxes, plus an unrequested "Adaptaciones" paragraph and reworded task 4 steps), left for CRITIQUE/DEBATE.
- **Checkpoint**: locate-by-feature-and-round
- **Decision notes**: SPEC wrote the contract from the accepted feature intent, spec and plan (2026-10-07). The first IMPL attempt ran in the main checkout's workspace (no `--cwd`) and wrote nothing; the second stopped at task 2 because Codex's sandbox has no network. With the user's OK, Claude pre-downloaded jsonc-parser@3.3.1 (sha512 checked against the registry) into a scratchpad npm cache and Codex installed it with `--offline`. The user approved one checkpoint per round instead of one commit per task. Quality gate passed (exit 0, no snapshot delta).
