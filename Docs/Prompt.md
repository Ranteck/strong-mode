## Prompt: Ultra-Strict TypeScript “Anti-Vibe-Chaos” Template

Quiero que generes un template de TypeScript para Node/ESM (o adaptable) con filosofía “ultra-strict” para vibe coding con IA: la IA no debe poder introducir bugs silenciosos sin romper gates. El template debe incluir configs + scripts y explicaciones mínimas. Objetivo: máximo rigor práctico, cerrando “escape hatches”.

### Requisitos de toolchain (capas/gates)

Implementar **dos niveles de gates**:

**Fast gate (local / pre-commit):**

1. formatter (Prettier o Biome)
2. linter (type-aware si es ESLint)
3. typecheck duro: `tsc --noEmit`

**Full gate (CI / quality):** 4) tests (Vitest) + coverage thresholds 5) dead code (Knip) 6) arquitectura/dependency graph (dependency-cruiser) + cycles (madge) 7) supply chain audit (`pnpm audit`/`npm audit`) y recomendación de Socket/Snyk

### Tipado TS (tsconfig ultra-strict)

Generar `tsconfig.json` con:

- `"strict": true`
- `"noUncheckedIndexedAccess": true`
- `"exactOptionalPropertyTypes": true`
- `"noImplicitOverride": true`
- `"useUnknownInCatchVariables": true`
- `"noImplicitReturns": true`
- `"noFallthroughCasesInSwitch": true`
- `"noUnusedLocals": true`, `"noUnusedParameters": true`
- ESM moderno: `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"verbatimModuleSyntax": true`
- Decisión explícita sobre `"esModuleInterop"`: por defecto `true` para compatibilidad con ecosistema npm, pero documentar trade-off.

### ESLint (flat config) ultra-strict + anti-escape

Crear `eslint.config.mjs` (flat config) con TypeScript type-aware (`parserOptions.project: true`) y reglas duras:

**Anti-escape hatches**

- Prohibir `any`: `@typescript-eslint/no-explicit-any: error`
- Prohibir `!` non-null: `@typescript-eslint/no-non-null-assertion: error`
- Limitar `ts-ignore/expect-error`: permitir solo con descripción mínima (>=10 chars)
- Prohibir casts tramposos: bloquear `unknown as X`, `any as X`, y doble `as` (ej `as unknown as T`) con `no-restricted-syntax`
- Permitir `as const` (inmutabilidad), pero prohibir “object literal assertions” (`{...} as T`)
  - Recomendar `@typescript-eslint/consistent-type-assertions` con `assertionStyle: "as"` y `objectLiteralTypeAssertions: "never"`

**Async correctness**

- `@typescript-eslint/no-floating-promises: error`
- `@typescript-eslint/no-misused-promises: error`
- `@typescript-eslint/await-thenable: error`

**Control flow / correctness**

- `@typescript-eslint/strict-boolean-expressions: error` (con configuración estricta; permitir `nullable boolean` si hace falta)
- `@typescript-eslint/switch-exhaustiveness-check: error`

**Imports**

- Eliminar imports muertos: `eslint-plugin-unused-imports`
- Ordenar imports: `eslint-plugin-simple-import-sort`
- Prevenir ciclos: `import/no-cycle: error`
- Nota: `eslint-plugin-import` puede fallar con flat config + TS; si da falsos positivos, usar `eslint-plugin-import-x` o configurar resolver TS explícitamente.

**Ergonomía controlada**

- `explicit-function-return-type`: error (o solo exports), explicar trade-off para vibe coding
- Complejidad/nesting: warn local y opcional error en CI

### Runtime validation (Zod)

Incluir `zod` y un patrón obligatorio:

- Todo input externo entra como `unknown` y se valida con schema.
- `schema.strict()` para prohibir campos extra.

### ENV: agujero crítico a cerrar

Crear `src/env.ts` obligatorio:

- Validar `process.env` con Zod al iniciar; si falla, `process.exit(1)`
- Exportar `env` tipado y prohibir `process.env` directo con ESLint (`no-restricted-properties`).

### Arquitectura verificable

Incluir:

- `dependency-cruiser` con reglas: no cycles y “domain no importa infra” como ejemplo.
- `madge --circular` para reporte rápido.

### Tests

- `vitest` + `@vitest/coverage-v8` con thresholds (ej lines 90%, branches 85%)
- Relajar algunas reglas de ESLint en `tests/**`.

### Dead code

- `knip` config básico para `src/index.ts` (ajustable)

### Hooks

Proveer `lefthook.yml` o alternativa para pre-commit ejecutando: format check, lint, typecheck.

### Scripts `package.json` (mínimo)

- `format`, `format:check`
- `lint` (con `--max-warnings 0`)
- `typecheck`
- `test`, `coverage`
- `dead-code`
- `deps:graph`, `deps:cycles`
- `check` (fast gate)
- `quality` (full gate)
- `audit`

### Entregables

Generar los archivos completos listos para copiar:

- `package.json` (scripts)
- `tsconfig.json`
- `eslint.config.mjs`
- `prettier.config.mjs` (o biome config si eliges Biome)
- `vitest.config.ts`
- `knip.config.ts`
- `depcruise.config.cjs`
- `lefthook.yml`
- `src/env.ts` y un ejemplo mínimo de Zod schema + parse function

Asegurarte de que el template sea consistente con ESM/NodeNext y explique brevemente las decisiones polémicas (assertions, esModuleInterop, strict boolean, return types).
