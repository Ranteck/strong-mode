# Plan: estado y próximos pasos (desde intent.md 2026-10-07)

Actualizado: 2026-10-07. Se actualiza al cerrar cada PR o ciclo; si este archivo queda viejo, las sesiones arrancan con hechos falsos.

## Archivos que cambian

Los de cada paso del orden de trabajo. Las features grandes nuevas abren su propia carpeta `intent/<slug>/` con intent, spec y plan, sin contradecir [intent.md](intent.md).

## Orden de trabajo

1. **PR #9** (`fix/generated-project-gates` → `main`): el CI está verde y la revisión de Codex lo aprobó. Mergear con squash, porque trae 12 commits de checkpoint del ciclo. Trae D1, cubre R18 y la parte de scaffold de R15, y agrega el rechazo de `"type": "commonjs"` explícito (R19); ver el [spec](spec.md).
2. **PR #10** (`feat/knip-framework-agnostic`, hoy apunta a #9): después de mergear #9, cambiarle la base a `main`, rebasearlo, volver a verificar y mergear (R13).
3. **PR #7** (Dependabot, postcss): actualizarlo y revisar las 14 alertas que GitHub reporta en `main` (8 altas).
4. Borrar los worktrees `strong-mode-gates` y `strong-mode-knip` cuando #9 y #10 estén mergeados.
5. **Este cambio** (`docs/sdlc-intent`): PR contra `main`. Al rebasearlo sobre #9, resolver el conflicto en `CLAUDE.md` y volver a evaluar R13, R15, R18 y R19 contra el código de `main`.
6. **Próximo ciclo** en `intent/duplicacion-reutilizacion/`: investigar herramientas existentes para R6 y R7 (C2).
7. Después, por prioridad:
   - C10: que el `tsconfig` existente quede tan estricto como el del template, que es el núcleo de la intención;
   - C11 y C12: frameworks fuera de `src/` y proyectos con otro runner;
   - C4, C5 y C6: gates y preservación;
   - C3: CommonJS, que lo decide el usuario;
   - C7, C8 y C9.

## Riesgos

- `CLAUDE.md` lo tocan tanto #9 como este cambio: va a haber un conflicto chico al rebasear.
- El spec describe comportamiento que todavía está en #9 y #10. Al mergear cada PR hay que volver a evaluar los requisitos que toca contra `main`, porque un PR puede dejarlos parciales.
- Los archivos de `intent/` se cargan en cada sesión, así que tienen que ser cortos y estar al día.

## Prueba

- **Cambios de código:**
  - `npm run check`;
  - `npm run build -w strong-mode && node packages/strong-mode/dist/cli.js --dry-run --yes`;
  - `/e2e-pm-matrix` si cambian `src/apply`, `package-manager.ts`, `process.ts` o el template.
- **Cambios en `intent/`:**
  - `prettier --check`;
  - que los imports de `CLAUDE.md` y los links resuelvan;
  - que una sesión nueva cargue la cadena.
