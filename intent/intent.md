# Intención: strong-mode

Autor: Denis Hugo Perafan · Estado: aceptado · Fecha: 2026-10-08

## Problema

Programando con IA ("vibe coding"), un proyecto TypeScript acumula errores que el modo
`strict` no frena: escapes del tipado (`any`, `!`, casts), código muerto, código duplicado o
reimplementado en vez de reutilizado, y entradas externas sin validar. Configurar a mano las
herramientas que lo detectan es largo y cada proyecto termina distinto. La idea original:
"evitar el 'slop' en el código".

## Resultado esperado

"Volver más estricto cualquier proyecto de TypeScript, como es el modelo del modo estricto de
TypeScript." Con un comando, un proyecto nuevo o existente queda con gates que fallan ante
escapes del tipado, código muerto, duplicación y falta de reutilización, más los del prompt
fundacional (`Docs/Prompt.md`): complejidad, arquitectura, cobertura de tests y auditoría de
dependencias. El proyecto pasa sus propios gates desde el primer día.

## Usuarios y sistemas afectados

Quien mantiene un proyecto TypeScript, nuevo o existente, y programa con IA; cualquier
framework y gestor de paquetes (npm, pnpm, Yarn, bun), y la configuración de sus
herramientas.

## Restricciones

- "Un wrapper que vuelva más estricto [...] para evitar duplicación de código, código
  muerto, errores típicos de la IA en el vibecoding": compone varias herramientas
  existentes, no las reimplementa.
- "Que se pueda instalar fácilmente a través de la CLI o por terminal" (`npx strong-mode`) y
  "que sirva para cualquier proyecto de TypeScript".
- No pisar el trabajo del usuario (campos y scripts; backup, merge o conflicto marcado),
  salvo las opciones de chequeo de tipos de `tsconfig.json`, que toman el valor del template.
- strong-mode cumple sus propias reglas: código propio chico, sin duplicación ni código
  muerto.

## Fuera de alcance

- Emular shells o gestores de paquetes: ante lo que no reconoce, hace lo conservador y
  explica por qué.
- Generar código de aplicación ni ser un framework o una librería de runtime.
- Reemplazar a las herramientas que compone: si difieren, gana la herramienta.

## Preguntas abiertas

- Duplicación entre archivos: ¿qué herramienta (por ejemplo, jscpd)? sonarjs solo la ve
  dentro de un archivo.
- Reutilización: ¿hay una herramienta que detecte funcionalidad reimplementada?
- CommonJS: el template es solo ESM; hoy se rechaza si se declara, y un proyecto sin `type`
  se convierte a ESM. ¿Soportarlo es parte de la intención?

## Cambios

- 2026-10-07: gates del prompt fundacional, pregunta sobre CommonJS corregida y excepción de
  `tsconfig.json` (C10). Aprobado por el usuario.
- 2026-10-08: formato del SDLC, sin cambiar la intención; CommonJS distingue los proyectos sin
  `type`. Aprobado por el usuario.
