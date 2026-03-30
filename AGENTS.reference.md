# AGENTS.md Reference Snippets

This file is reference material for humans or wrapper tooling.
It is not an active instruction file unless its contents are copied or injected into the effective prompt or project instructions.

## Reusable section: centralized configuration and logging

Copy and adapt this section into a project `AGENTS.md` when you want agents to keep reusable infrastructure centralized.

```md
## Shared Configuration and Logging

Keep configuration centralized in shared modules or entry points. Do not scatter environment variable reads, hardcoded defaults, or parallel config files across features. When new configuration is needed, extend the existing shared configuration layer first so all consumers reuse the same source of truth.

Keep logging centralized in shared helpers. Reuse the project's common logger setup, formatters, levels, and sinks instead of adding ad hoc `echo`, `print`, or one-off logger initialization. New modules should plug into the existing logging layer so logs stay consistent and reusable.

When adding cross-cutting infrastructure such as configuration, logging, HTTP clients, or storage helpers, prefer extending a shared module over creating a feature-local implementation.

Centralize only when a shared layer already exists or the concern is clearly cross-cutting. Do not invent a new shared abstraction unless the task actually needs one.

Before adding a new helper, module, or service, look for an existing reusable layer first and prefer extending it. If you add a new shared component, explain briefly why the existing code was not sufficient.
```

## Short memory-style variant

Use this shorter version in memory-style files such as `state/claude/memory.md`.

```md
- **Centralized Configuration**: Keep configuration in shared modules or entry points. Reuse the existing config layer instead of scattering environment variable reads, defaults, or parallel config files across the codebase.
- **Centralized Logging**: Reuse the shared logging utilities and logger setup instead of ad hoc prints or one-off log configuration so format, levels, and sinks stay consistent.
- **Reusable Infrastructure**: When adding cross-cutting concerns such as configuration, logging, HTTP clients, or storage helpers, extend a shared module first so the implementation can be reused.
- **No Premature Shared Layers**: Create or expand shared abstractions only when a shared layer already exists or the concern is clearly cross-cutting.
```

## Reusable section: safe change scope and validation

Copy and adapt this section into a project `AGENTS.md` when you want agents to keep changes small, verifiable, and safe.

```md
## Safe Change Scope and Validation

Prefer the smallest change that solves the requested task. Reuse existing modules, scripts, and helpers before introducing new files, patterns, or abstractions. Avoid broad refactors unless they are required to complete the work safely.

Before finishing, run the lightest relevant validation for the area you changed, such as syntax checks, lint, or a targeted test command. Prefer targeted validation over full-suite runs unless broader coverage is necessary. If validation cannot be run, state that clearly and mention what remains unverified.

When editing scripts or automation, keep operations idempotent when possible so repeated runs do not duplicate state, break configuration, or create divergent outputs.
```

## Reusable section: error handling and operational safety

Copy and adapt this section into a project `AGENTS.md` when you want agents to preserve consistent failure handling.

```md
## Error Handling and Operational Safety

Fail with clear, actionable error messages. Do not silently swallow errors or continue after partial failures unless the fallback behavior is intentional, visible to the operator, and preserves correctness.

For file operations, backups, restores, and automation flows, prefer explicit checks for file existence, directory creation, and overwrite behavior before mutating state. Use shared helpers for these operations when available so behavior stays consistent across commands.
```

## Additional short memory-style variants

```md
- **Safe Change Scope**: Prefer the smallest change that solves the task. Reuse existing modules and helpers before introducing new files or abstractions.
- **Validation**: Run the lightest relevant syntax, lint, or targeted test command for the area you change. Prefer targeted validation before full-suite runs. If you cannot validate, state it clearly.
- **Operational Safety**: Keep scripts and automation idempotent when possible, and fail with clear actionable errors instead of silent fallbacks.
```
