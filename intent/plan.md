# Plan: estado y próximos pasos (desde intent.md 2026-10-07)

Actualizado: 2026-10-07. Se actualiza al cerrar cada PR o ciclo; si este archivo queda viejo, las sesiones arrancan con hechos falsos.

## Archivos que cambian

Los de cada paso del orden de trabajo. Las features grandes nuevas abren su propia carpeta `intent/<slug>/` con intent, spec y plan, sin contradecir [intent.md](intent.md).

## Hecho

- PR #9 mergeado (`cce16c4`): los proyectos aplicados pasan sus gates (scaffold verificado en CI), la detección de Vitest es una lista blanca (D1), y se rechaza `"type": "commonjs"` antes de escribir.
- PR #10 mergeado (`c08d969`): knip agnóstico de framework (v6), y el CI corre el `dead-code` del repo y verifica el del proyecto generado.
- Limpieza: se borraron las ramas mergeadas y los worktrees de #9 y #10.
- PR #11 mergeado (`4bf05ec`): la cadena `intent/` del AI-Native SDLC.
- Dependencias: se cerraron las 17 alertas de Dependabot, todas de desarrollo. `npm audit fix` sin `--force` y Vitest a `^4.1.11` (GHSA-82fw) dejan `npm audit` en 0.

## Orden de trabajo

1. **C10:** que un `tsconfig.json` existente quede tan estricto como el del template. Es el núcleo de la intención.
2. **Ciclo `intent/duplicacion-reutilizacion/`:** investigar herramientas existentes para R6 y R7 (C2).
3. **C11 y C12:** frameworks con código fuera de `src/` y proyectos con otro runner.
4. **C4, C5 y C6:** gates y preservación.
5. **C3, CommonJS:** decidir si el soporte es parte de la intención. Si lo es, abrir un ciclo propio. En los dos casos, actualizar la frase de `intent.md` en `## Cambios`, con OK del usuario.
6. C7 y C9.

## Riesgos

- Cuando un PR se mergea, hay que volver a evaluar contra `main` cada requisito que toca, porque un PR puede dejarlo parcial.
- Los archivos de `intent/` se cargan en cada sesión, así que tienen que ser cortos y estar al día.

## Prueba

- **Cambios de código:**
  - `npm run check`;
  - `npm run build -w strong-mode && node packages/strong-mode/dist/cli.js --dry-run --yes`;
  - `npm run dead-code`;
  - `/e2e-pm-matrix` si cambian `src/apply`, `package-manager.ts`, `process.ts` o el template.
- **Cambios en `intent/`:**
  - `npm run format:check` (Prettier sobre todo el repo);
  - que los imports de `CLAUDE.md` y los links resuelvan;
  - que una sesión nueva cargue la cadena.
