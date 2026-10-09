# Spec: strong-mode (desde intent.md 2026-10-08)

Estado: aceptado

## Requisitos

- REQ-1 MUST: un comando (`npx strong-mode`) aplica strong-mode a un proyecto TypeScript
  nuevo o existente. Origen: Restricciones, "instalar fácilmente a través de la CLI".
- REQ-2 MUST: el `tsconfig.json` queda con todas las opciones de chequeo de tipos del
  template, aunque el proyecto las tuviera más laxas, y strong-mode avisa cuáles subió.
  Origen: Resultado esperado, "volver más estricto"; la excepción de Restricciones.
- REQ-3 MUST: los gates fallan ante escapes del tipado (`any`, `!`, casts) y código muerto.
  Origen: Problema y Resultado esperado.
- REQ-4 MUST: los gates fallan ante código duplicado, también entre archivos. Origen:
  Resultado esperado.
- REQ-5 MUST: los gates fallan ante funcionalidad reimplementada en vez de reutilizada.
  Origen: Resultado esperado; la herramienta es una pregunta abierta.
- REQ-6 MUST: los gates cubren complejidad, arquitectura, cobertura de tests y auditoría de
  dependencias. Origen: Resultado esperado, prompt fundacional.
- REQ-7 SHOULD: las entradas externas pasan por una validación con tipos. Origen: Problema,
  "entradas externas sin validar".
- REQ-8 MUST: después de aplicar, el proyecto pasa sus propios gates. Origen: Resultado
  esperado, "desde el primer día".
- REQ-9 MUST: funciona con cualquier framework y con npm, pnpm, Yarn y bun. Origen: Usuarios y Restricciones.
- REQ-10 MUST: conserva los campos y scripts del usuario; lo que no puede combinar queda con
  backup o conflicto marcado. Origen: Restricciones, "no pisar el trabajo del usuario".
- REQ-11 MUST: ante lo que no reconoce, hace lo conservador y explica por qué. Origen: Fuera
  de alcance.
- REQ-12 MUST: compone herramientas existentes en vez de reimplementarlas; si difieren, gana
  la herramienta. Origen: Restricciones, "un wrapper"; Fuera de alcance.
- REQ-13 MUST: el código propio pasa los mismos gates: chico, sin duplicación ni código
  muerto. Origen: Restricciones, "cumple sus propias reglas".

## Capacidades y escenarios

### Aplicar con un comando (REQ-1, REQ-8)

- GIVEN un proyecto TypeScript nuevo
- WHEN se corre `npx strong-mode --yes`
- THEN quedan instalados los gates y todos pasan.

### Más estricto que `strict` (REQ-2)

- GIVEN un `tsconfig.json` con `"strict": false` y comentarios
- WHEN se aplica strong-mode
- THEN queda `"strict": true`, los comentarios siguen y la salida avisa
  `strict (false → true)`.

### Gates que fallan (REQ-3 a REQ-7)

- GIVEN un proyecto aplicado
- WHEN alguien agrega un `any`, un export sin uso, código copiado de otro archivo, una
  función que reimplementa una existente, una función demasiado compleja, una entrada externa
  sin validar o una dependencia vulnerable
- THEN el gate correspondiente falla y nombra el problema.

### No pisar al usuario, y rechazar con explicación (REQ-10, REQ-11)

- GIVEN un `package.json` con scripts propios
- WHEN se aplica strong-mode
- THEN los scripts siguen y solo se agregan los del template.
- GIVEN un archivo que no se puede combinar sin riesgo, o un proyecto `"type": "commonjs"`
- WHEN se aplica con `--yes`
- THEN el archivo queda con conflicto marcado, o strong-mode se detiene antes de escribir, y
  la salida explica por qué.

### Cualquier gestor y framework (REQ-9)

- GIVEN el mismo proyecto con npm, pnpm, Yarn o bun, o con código fuera de `src/`
- WHEN se aplica strong-mode
- THEN instala con ese gestor y los gates revisan todo el código del proyecto.

### Código propio (REQ-12, REQ-13)

- GIVEN el repositorio de strong-mode
- WHEN corre su CI
- THEN typecheck, lint, tests y código muerto pasan, y ninguna lógica propia duplica a una
  herramienta compuesta.

## Concerns

Esperan una decisión del dueño; los huecos están en [plan.md](plan.md).

- **CommonJS.** Un `"type": "commonjs"` declarado se rechaza; sin `type`, el proyecto pasa a
  ESM y sus `.js` CommonJS se rompen. ¿Soportarlo es parte de la intención?
  (REQ-9).
- **Duplicación entre archivos y reutilización.** Falta elegir herramientas. Si no existe
  una para reutilización, REQ-5 exige construir algo propio, que la intención descarta.
- **`noCheck: true`.** Apaga el chequeo de tipos aunque REQ-2 se cumpla.
  ¿strong-mode lo fuerza a `false`?
- **Otros runners de tests.** Con Jest, la cobertura igual corre Vitest. ¿Se
  adaptan los gates al runner o se exige Vitest? (REQ-6, REQ-8).
- **Formato de lo que strong-mode combina.** Puede no pasar el chequeo de formato. ¿strong-mode lo formatea? (REQ-8).
