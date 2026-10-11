# Plan: tsconfig estricto al aplicar (desde intent.md 2026-10-07)

Estado: aceptado

> Se ejecuta con `/graph-engineer` (Codex escribe y critica, Claude arbitra), en
> `~/Proyectos/strong-mode-tsconfig`, rama `feat/strict-tsconfig-merge`.

**Objetivo:** que `npx strong-mode` deje el `tsconfig.json` existente tan estricto como el
template en las opciones de chequeo, editándolo en el lugar.

**Arquitectura construida:** `TYPE_CHECKING_OPTIONS` define las rutas del template.
`merge.ts` lee JSONC, calcula el merge y edita diferencias con `modify` + `applyEdits`.
Devuelve las opciones subidas y `execute.ts` las avisa. Spec: [spec.md](spec.md), T1–T8.

## Restricciones globales

- `jsonc-parser@^3.3.1` es la única dependencia runtime nueva.
- Las 21 opciones son las 20 de la categoría _Type Checking_ de TypeScript 5.9, en su
  orden, más `noCheck`: apaga el chequeo entero, por eso el template fija `false`.
- Los valores viven en el template; las opciones ajenas conservan los del proyecto.
- Se edita en el lugar con 2 espacios para inserciones, conservando BOM y fin de línea.
- Un valor del template que difiere se reemplaza entero, comentarios internos incluidos,
  salvo arrays cuyo destino conserva el prefijo del proyecto: solo se agrega el resto.
  Nada fuera de un valor del template se reemplaza; ningún otro comentario se borra.
- Límite aceptado: insertar puede desplazar el comentario tras la última entrada y
  reindentar o reespaciar la línea vecina.
- Cambios del template y README requieren `npm run sync:template`.
- Conventional Commits; ningún push, PR ni merge sin confirmación del usuario.

## Archivos y trabajo construido

### Tarea 1: las 21 opciones y el template (T2, T8)

- `constants.ts` exporta `TYPE_CHECKING_OPTIONS: readonly string[]`.
- El template `tsconfig.json` fija todas como booleanos, incluidas
  `strictBuiltinIteratorReturn: true`, `allowUnusedLabels: false`,
  `allowUnreachableCode: false` y `noCheck: false`.
- `src/env.ts` declara `process` localmente, sin depender de globals de `@types/node`.
  Lee `process.env` directamente y es para Node: sin `process`, falla al importar
  (decisión del dueño, 2026-10-09).
- `constants.test.ts` verifica booleanos y que TypeScript reconoce las opciones; prueba
  `env.ts` bajo `types: []` con el lib del template y con DOM, sin diagnósticos. Un hermano
  que lee `process` obtiene TS2591; las rutas se normalizan. Zod debe estar declarado y la
  versión del repo debe satisfacer su rango. Los enlaces usan junctions.

### Tarea 2: merge JSONC y edición en el lugar (T1, T3, T4, T5)

`merge.ts` conserva `mergeJsonValues`: escalares del proyecto, unión append-only de
arrays sin quitar duplicados del proyecto y `extends` preservado. Después aplica las
rutas del template: opciones de chequeo en `tsconfig.json`, `exclude` en
`tsconfig.eslint.json`; solo si el template las define.

Se aceptan comentarios, comas finales y un BOM del proyecto. Sintaxis inválida, raíz o
`compilerOptions` no objeto, claves duplicadas o `__proto__` devuelven `undefined`.
El texto editado se vuelve a leer y debe coincidir con el merge calculado.

Interfaces implementadas, conservadas:

```ts
export interface RaisedOption {
  readonly name: string;
  readonly from: unknown;
  readonly to: unknown;
}
export interface MergeResult {
  readonly content: string;
  readonly raisedOptions: readonly RaisedOption[];
}
export const mergeManagedFileContent: (
  relativePath: string,
  existingContent: string,
  incomingContent: string,
) => MergeResult | undefined;
```

`merge.test.ts` conserva las aserciones previas leyendo `result?.content`. El test de
propiedad reemplaza `noCheck: { /* reason */ "enabled": true }` por `false`, conserva
un comentario externo y reporta `noCheck` en `raisedOptions`.

### Tarea 3: avisos (T6)

`execute.ts` consume `MergeResult`. Avisa una vez por archivo si el merge inseguro
deja marcadores de conflicto. Después del merge avisa las opciones explícitas cambiadas,
en orden de `TYPE_CHECKING_OPTIONS`, con valores `JSON.stringify`:

```text
<archivo>: raised|would raise <opción> (<antes> → <después>), ... to the strong-mode values. Type errors they reveal in your code are expected; fix the code rather than lowering the options.
```

`--dry-run` dice `would raise` y no escribe. `execute.test.ts` cubre ambas variantes y el
fallback con títulos únicos por fila de `it.each`.

### Tarea 4: documentación y SDLC

README (+sync) y CLAUDE describen la propiedad de valores y comentarios y el destino
Node de `env.ts`. El intent de la feature registra las decisiones del 2026-10-09; el spec
declara MUST en T1–T8.

El spec raíz ya no tiene concern de `noCheck`. El plan raíz registra las decisiones finales
y el hueco del TypeScript mínimo (ES2024 requiere 5.7; `noCheck` y
`strictBuiltinIteratorReturn`, 5.6), sin agregar un gate. Al cerrar la feature, REQ-2 pasa
a `cubre` y se borra el paso 1.

## Requisito → test

| Requisito | Test / verificación                                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1        | `merge.test.ts`: opciones explícitas suben y se listan en orden                                                                                    |
| T2        | `constants.test.ts`: 21 booleanos y `ts.parseJsonConfigFileContent` sin errores                                                                    |
| T3        | `merge.test.ts`: escalares, `extends`, arrays, `skipLibCheck`, `verbatimModuleSyntax`, `isolatedModules`; no se fuerza chequeo en tsconfig de lint |
| T4        | `merge.test.ts`: JSONC, BOM, datos inválidos, duplicados, `__proto__` y verificación del texto; `execute.test.ts`: fallback explicado              |
| T5        | `merge.test.ts`: comentarios, orden, comas, CRLF, append y propiedad de `noCheck` / `exclude`                                                      |
| T6        | `merge.test.ts`: `raisedOptions`; `execute.test.ts`: aviso y dry-run                                                                               |
| T7        | Apply real sobre `tsc --init` con `strict: false`, más `/e2e-pm-matrix`; verificación de entrega                                                   |
| T8        | `constants.test.ts`: lib del template / DOM, `types: []`, localidad de `process` y rango de Zod                                                    |

## Verificación y entrega

- Verificado el 2026-10-09: sync, `npm run check` (298 tests),
  `npm run format:check`, `npm run dead-code`, build y smoke con `--dry-run --yes` pasan.
  Un fixture local con las dependencias del repo pasa tsc, lint de `env.ts` y sus dos
  tests con cobertura del 100%; no sustituye la matriz de gestores con instalación.
- Para T7: apply real sobre `tsc --init` con `strict: false`; comprobar aviso,
  comentarios, ausencia de conflictos y typecheck. `/e2e-pm-matrix` verifica gestores.
- Revisión, challenger y VERIFY antes de cerrar y archivar el contexto. `/pre-push`
  antes de cualquier push.

## Riesgos

- `jsonc-parser` usa su entrada CommonJS: su build ESM no carga en Node. El smoke del
  CLI empaquetado verifica que tsup mantenga la dependencia externa.
- El código laxo del proyecto puede fallar el typecheck: el aviso explica que se arregla
  el código. No se fuerzan opciones fuera del contrato.
- Lo insertado puede no pasar Prettier, límite ya existente; no se formatea el merge.
- Tsconfigs de lint propios y solution-style siguen fuera de alcance de esta feature.
