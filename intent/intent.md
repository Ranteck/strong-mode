# Intención: strong-mode

Autor: Denis Hugo Perafan · Estado: aceptado · Fecha: 2026-10-07

## Problema

Programando con IA ("vibe coding"), un proyecto TypeScript acumula errores que el modo
`strict` de TypeScript no frena: escapes del tipado (`any`, `!`, casts), código muerto,
código duplicado, funcionalidad reimplementada en vez de reutilizada y entradas externas sin
validar. Configurar a mano las herramientas que detectan todo eso es largo, y cada proyecto
termina distinto. La idea original: "evitar el 'slop' en el código" y "prevenir errores
durante el vibe-coding".

## Resultado esperado

"Volver más estricto cualquier proyecto de TypeScript, como es el modelo del modo estricto de
TypeScript." Con un comando, un proyecto nuevo o existente queda con gates que fallan ante
código muerto, duplicación, falta de reutilización y escapes del tipado, y el proyecto pasa
sus propios gates desde el primer día. Además, con los gates del prompt fundacional
(`Docs/Prompt.md`): complejidad acotada, arquitectura verificable, tests con cobertura mínima
y auditoría de dependencias.

## Usuarios y sistemas afectados

- Quien mantiene un proyecto TypeScript, nuevo o existente, y programa con asistentes de IA.
- Cualquier framework (frame-agnostic) y cualquier gestor de paquetes (npm, pnpm, Yarn, bun).
- La configuración del proyecto: tsconfig, ESLint, Prettier, Vitest, knip,
  dependency-cruiser, lefthook y package.json.

## Restricciones

- "Que se pueda instalar fácilmente a través de la CLI o por terminal": `npx strong-mode`.
- "Que sirva para cualquier proyecto de TypeScript."
- "Buscar otros proyectos que tengan la potencia para encontrar código muerto, duplicación de
  código, reutilización": componer herramientas existentes, no reimplementarlas.
- No pisar el trabajo del usuario: conservar sus campos y scripts, con backup, merge o
  conflicto marcado.
- strong-mode cumple sus propias reglas: "un wrapper que vuelva más estricto [...] para evitar
  duplicación de código, código muerto, errores típicos de la IA en el vibecoding". Su código
  propio queda chico, sin duplicación ni código muerto.

## Fuera de alcance

- Emular shells o gestores de paquetes: ante lo que no reconoce, strong-mode hace lo
  conservador y explica por qué.
- Generar código de aplicación, o ser un framework o una librería de runtime.
- Reemplazar a las herramientas que compone: si su comportamiento y el nuestro difieren,
  gana el de la herramienta.

## Preguntas abiertas

- Duplicación entre archivos: ¿qué herramienta? Hoy sonarjs solo la detecta dentro de un
  archivo (por ejemplo, evaluar jscpd).
- Reutilización (detectar funcionalidad reimplementada): ¿existe una herramienta que sirva?
- "Cualquier proyecto" frente a CommonJS: el template es solo ESM. En `main`, strong-mode lo
  aplica igual sobre un proyecto `"type": "commonjs"` y lo rompe; PR #9 agrega el rechazo
  antes de escribir. ¿El soporte de CommonJS es parte de la intención o queda como
  limitación?

## Cambios

<!-- AAAA-MM-DD: qué cambió y por qué (aprobado por el usuario) -->

- 2026-10-07: "Resultado esperado" suma los gates del prompt fundacional (complejidad,
  arquitectura, cobertura de tests, auditoría de dependencias), que el spec usaba sin que
  estuvieran en la intención. Aprobado por el usuario.
- 2026-10-07: se corrige la pregunta sobre CommonJS. Decía que strong-mode ya rechaza esos
  proyectos, pero en `main` no hay rechazo: llega con PR #9. Lo detectó la revisión de Codex;
  aprobado por el usuario.
