# Plan: strong-mode (desde spec.md 2026-10-08 e intent.md 2026-10-08)

Estado: aceptado

## Archivos que cambian

Cada paso del orden de trabajo abre su feature en `intent/<slug>/`, con intent, spec y plan
propios que nombran sus archivos. Esta reorganización del SDLC cambia `intent/intent.md`,
`intent/spec.md`, `intent/plan.md`, `CLAUDE.md` (sección "Read first" y proceso del repo) y
`AGENTS.md` (descripción de la cadena).

## Tests a escribir

Estado en `main` (`44a3955`) al 2026-10-08: **cubre** (un test o el CI lo ejercita),
**parcial** o **falta**. Un REQ pasa a "cubre" solo con un test o un paso de CI que lo
ejercite.

| Test (comportamiento observable)                                                                 | REQ          | Estado                                                                           |
| ------------------------------------------------------------------------------------------------ | ------------ | -------------------------------------------------------------------------------- |
| CI: el CLI empaquetado aplica sobre un proyecto nuevo y su `check` pasa; tests unitarios del CLI | REQ-1, REQ-8 | cubre en proyectos nuevos; falta uno existente con otro runner o fuera de `src/` |
| Un `tsconfig.json` con `"strict": false` y comentarios queda estricto y la salida lo avisa       | REQ-2        | falta en `main`; hecho en `feat/strict-tsconfig-merge`                           |
| CI: el lint del proyecto generado falla ante `any`, `!` y casts                                  | REQ-3        | falta: hoy solo se prueba que el lint pasa                                       |
| CI: `dead-code` falla y nombra el código muerto                                                  | REQ-3        | cubre                                                                            |
| El gate falla ante código copiado entre archivos                                                 | REQ-4        | falta: no hay herramienta                                                        |
| El gate falla ante una función reimplementada                                                    | REQ-5        | falta: no hay herramienta                                                        |
| CI: complejidad, dependency-cruiser, madge y audit fallan ante un proyecto que los viola         | REQ-6        | parcial: solo la cobertura mínima corre, dentro del apply                        |
| El `tests/env.test.ts` del template valida el entorno con Zod                                    | REQ-7        | parcial: solo variables de entorno                                               |
| `/e2e-pm-matrix` con npm 10 y 11, pnpm, Yarn 1 y bun                                             | REQ-9        | parcial: es manual, y en Yarn 1 y bun el lint con tipos se cae                   |
| `patchers.test.ts` y `merge.test.ts`: el merge conserva campos y scripts                         | REQ-10       | parcial: el `engines` del template pisa el del usuario                           |
| `scripts.test.ts`, `module-system.test.ts` y el CI de CommonJS: rechazo explicado                | REQ-11       | cubre                                                                            |
| Revisión de altitud en cada ciclo: ningún helper propio emula a una herramienta                  | REQ-12       | sin test automático                                                              |
| CI del repo: `check` y `dead-code` del CLI                                                       | REQ-13       | parcial: no corre `quality` sobre sí mismo                                       |

## Orden de trabajo

1. **Cerrar `tsconfig-estricto` (REQ-2).** La rama está en `3f911cd`, en pausa. Falta
   decidir tres cosas:
   - los comentarios que cambian de lugar al insertar opciones (T5 de la feature);
   - `noCheck` (concern del spec);
   - el `process` declarado en `src/env.ts`, que en un proyecto de navegador compila pero
     falla al ejecutarse.

   Después: revisión, challenger, VERIFY con `/e2e-pm-matrix`, archivo del contexto, docs de
   la feature (REQ-n y tabla de tests) y PR.

2. **Duplicación y reutilización (REQ-4, REQ-5):** feature `intent/duplicacion-reutilizacion/`
   para elegir herramientas existentes.
3. **Frameworks, runners y gestores (REQ-8, REQ-9):**
   - código fuera de `src/`;
   - `tsconfig.eslint.json` propios y tsconfigs con `references`;
   - otros runners, según la decisión del concern;
   - el lint con tipos en Yarn 1 y bun.
4. **Gates y preservación (REQ-6, REQ-8, REQ-10):**
   - `check`, `quality` y `audit` llaman a `npm`, y `audit` exige `package-lock.json`;
   - el pre-commit no corre `dead-code` y nada fuerza `quality`;
   - el `engines` del template pisa el del usuario;
   - el formato de lo que se combina, según la decisión del concern;
   - el CI no ejercita dependency-cruiser, madge ni audit.
5. **Escapes del tipado (REQ-3):** un `as` simple pasa y los tests relajan `no-explicit-any`;
   sumar al CI un proyecto que tiene que fallar.
6. **Código propio (REQ-13):** el CI corre `quality` sobre strong-mode; las regex de configs
   de ESLint en `execute.ts` no coinciden con el resolver de scripts.
7. **CommonJS:** decisión del dueño, que incluye a los proyectos sin `type`, hoy convertidos
   a ESM.

## Riesgos

- Si este archivo queda viejo, las sesiones arrancan con hechos falsos: se actualiza al
  cerrar cada PR o ciclo, y cada REQ que el PR toca se reevalúa contra `main`.
- `feat/strict-tsconfig-merge` usa la numeración vieja (R2, C10–C16). Al integrarle `main`,
  se traduce a REQ-n.
- Los archivos de `intent/` se cargan en cada sesión, así que tienen que ser cortos.

## Prueba

- **Cambios de código:**
  - `npm run check`;
  - `npm run build -w strong-mode && node packages/strong-mode/dist/cli.js --dry-run --yes`;
  - `npm run dead-code`;
  - `/e2e-pm-matrix` si cambian `src/apply`, `package-manager.ts`, `process.ts` o el
    template.
- **Cambios en `intent/`:**
  - `npm run format:check`;
  - que los links y los imports de `CLAUDE.md` resuelvan;
  - que una sesión nueva cargue la cadena.
- **Cada REQ** se demuestra con su fila de la tabla de tests.
