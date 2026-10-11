# Plan: tsconfig estricto al aplicar (desde spec.md 2026-10-10 e intent.md 2026-10-09)

Estado: aceptado

Se ejecuta con `/graph-engineer` (Codex escribe y critica, Claude arbitra), en el worktree
`~/Proyectos/strong-mode-tsconfig`, rama `feat/strict-tsconfig-merge`. Los requisitos son
T1–T8 de [spec.md](spec.md).

## Archivos que cambian

- `packages/strong-mode/src/apply/constants.ts` y su test: `TYPE_CHECKING_OPTIONS`.
- `packages/scaffold-ultra/template/tsconfig.json` y `src/env.ts`, con su copia en
  `packages/strong-mode/template/`.
- `packages/strong-mode/src/apply/merge.ts` y su test: lectura JSONC, rutas del template y
  edición en el lugar.
- `packages/strong-mode/src/apply/execute.ts` y su test: los avisos.
- `packages/strong-mode/package.json` y `package-lock.json`: `jsonc-parser@^3.3.1`, la única
  dependencia nueva.
- `README.md` con su copia, `CLAUDE.md`, `intent/spec.md` e `intent/plan.md`.

## Tests a escribir

Todos existen, salvo T7, que se comprueba en la verificación final.

| Requisito | Test o verificación                                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| T1        | `merge.test.ts`: las opciones explícitas suben y se listan en orden                                                                          |
| T2        | `constants.test.ts`: el template fija las 21 como booleanos y TypeScript reconoce cada nombre                                                |
| T3        | `merge.test.ts`: escalares, `extends`, arrays, `skipLibCheck`, `verbatimModuleSyntax` e `isolatedModules` del proyecto quedan                |
| T4        | `merge.test.ts`: JSONC, BOM, datos inválidos, claves duplicadas, `__proto__` y relectura del texto; `execute.test.ts`: el aviso del fallback |
| T5        | `merge.test.ts`: comentarios, orden, comas finales, CRLF, agregado al final de arrays y reemplazo entero de un valor del template            |
| T6        | `merge.test.ts`: `raisedOptions`; `execute.test.ts`: el aviso y su variante con `--dry-run`                                                  |
| T7        | Apply real sobre un proyecto `tsc --init` con `strict: false`, más `/e2e-pm-matrix`                                                          |
| T8        | `constants.test.ts`: `env.ts` sin diagnósticos con `types: []` (lib del template y DOM), `process` local al archivo y `zod` dentro del rango |

## Orden de trabajo

1. **Las 21 opciones y el template (T2, T8).** Hecho. `TYPE_CHECKING_OPTIONS` nombra las 20
   opciones de _Type Checking_ de TypeScript 5.9 más `noCheck`. El template las fija todas.
   Su `src/env.ts` declara `process` localmente, lee `process.env` y es para Node.
2. **Merge JSONC en el lugar (T1, T3, T4, T5).** Hecho. `merge.ts` lee con `jsonc-parser`,
   calcula el merge de siempre, aplica las rutas del template y escribe solo las diferencias.
   Devuelve el contenido y las opciones que subió, o `undefined` si no puede editar sin
   riesgo.
3. **Avisos (T6).** Hecho. `execute.ts` avisa las opciones subidas, con "would raise" en
   `--dry-run`, y avisa cuando un tsconfig queda con marcadores de conflicto.
4. **Docs.** Hecho: README, `CLAUDE.md` y la cadena del SDLC, raíz y de la feature.
5. **Cierre.** Falta:
   - el challenger final;
   - la verificación de T7 y `/e2e-pm-matrix`;
   - archivar el contexto del ciclo;
   - en el plan raíz, pasar REQ-2 a "cubre" y borrar el paso 1;
   - `/pre-push` y el PR.

   Push, PR y merge necesitan, cada uno, la confirmación del usuario.

## Riesgos

- `jsonc-parser` se carga por su entrada CommonJS, porque su build ESM no carga en Node. El
  dry-run del CLI empaquetado comprueba que tsup la deje externa.
- Un proyecto con código laxo puede fallar el typecheck después del apply. Es lo esperado:
  el aviso explica que se arregla el código, no las opciones.
- Lo insertado puede no pasar Prettier. Ya pasaba en `main`, y el merge no se formatea.
- Los `tsconfig.eslint.json` propios y los tsconfig _solution-style_ siguen fuera de alcance.
- El template necesita TypeScript 5.7 o mayor, y nada lo comprueba (hueco del plan raíz).

## Prueba

- `npm run check`, `npm run format:check` y `npm run dead-code`. Verificado el 2026-10-10,
  con 298 tests.
- `npm run build -w strong-mode && node packages/strong-mode/dist/cli.js --dry-run --yes`.
- T7: un apply real sobre `npm init` más `tsc --init` con `strict: false`. Tiene que salir
  el aviso `strict (false → true)`, quedar los comentarios, no haber marcadores de conflicto
  y pasar typecheck, lint y test.
- `/e2e-pm-matrix`, porque cambian `src/apply` y el template.
