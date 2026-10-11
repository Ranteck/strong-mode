# Spec: tsconfig estricto al aplicar (desde intent.md 2026-10-07)

Estado: aceptado

## Requisitos

Cada requisito cita la parte de [intent.md](intent.md) de la que sale y los tests que lo
cubren.

| #   | Requisito                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Intent                                                                     | Tests                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| T1  | MUST: En el `compilerOptions` de `tsconfig.json`, las 20 opciones de la categoría _Type Checking_ de TypeScript, más `noCheck` (`TYPE_CHECKING_OPTIONS`) toman el valor del template, aunque el proyecto las tenga explícitas                                                                                                                                                                                                                                                                                                                                                                          | Resultado esperado ("Gana el template")                                    | `merge.test.ts`: `strict: false` y otras opciones explícitas suben al valor del template                                       |
| T2  | MUST: El template fija las 21: suma `strictBuiltinIteratorReturn: true`, `allowUnreachableCode: false`, `allowUnusedLabels: false` y `noCheck: false`                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Restricciones (la categoría la define TS)                                  | `constants.test.ts`: el template fija cada opción de la lista, y TypeScript reconoce cada nombre                               |
| T3  | MUST: El resto se mergea como hoy: lo del proyecto gana, los arrays se unen y `extends` no se toca. `skipLibCheck`, `verbatimModuleSyntax` e `isolatedModules` del proyecto quedan. El `exclude` de `tsconfig.eslint.json` sigue siendo del template                                                                                                                                                                                                                                                                                                                                                   | Restricciones, Fuera de alcance                                            | `merge.test.ts`: los tests de merge actuales siguen pasando, más uno con `target` y `skipLibCheck: true` del proyecto          |
| T4  | MUST: Lee el tsconfig como tsc, con comentarios y comas finales. Si no lo puede leer (sintaxis inválida, raíz que no es objeto, o `compilerOptions` que no es objeto), escribe marcadores de conflicto como hoy                                                                                                                                                                                                                                                                                                                                                                                        | Problema                                                                   | `merge.test.ts`: un archivo tipo `tsc --init` se mergea; JSON inválido y `compilerOptions` no objeto devuelven `undefined`     |
| T5  | MUST: escribe solo las diferencias sobre el texto original, conservando orden de claves, comas finales y fin de línea. Un valor del template que difiere (opciones de chequeo en `tsconfig.json`, `exclude` en `tsconfig.eslint.json`) se reemplaza entero, comentarios internos incluidos, salvo el append de arrays que conserva el prefijo del proyecto. Nada fuera de un valor del template se reemplaza, así que ningún otro comentario se borra. Límite aceptado: un comentario tras la última entrada puede quedar después de lo insertado y la línea vecina puede reindentarse o reespaciarse. | Resultado esperado ("Leer y editar en el lugar")                           | `merge.test.ts`: comentarios y CRLF; objeto `noCheck` reemplazado y comentario externo conservado; arrays unidos y `exclude`   |
| T6  | MUST: Avisa qué opciones subió, solo las que el proyecto tenía explícitas con otro valor, y desde qué valor, antes de instalar y chequear. Con `--dry-run` dice "would raise"                                                                                                                                                                                                                                                                                                                                                                                                                          | Resultado esperado                                                         | `merge.test.ts`: la lista de opciones subidas; `execute.test.ts`: el aviso y su variante con `--dry-run`                       |
| T7  | MUST: Un apply real sobre un proyecto `tsc --init` con `strict: false` deja el `tsconfig.json` estricto, con los comentarios intactos, y corre el typecheck                                                                                                                                                                                                                                                                                                                                                                                                                                            | Resultado esperado                                                         | Verificación manual, más `/e2e-pm-matrix`                                                                                      |
| T8  | MUST: el template `src/env.ts` typecheckea bajo `types: []`, con el `lib` del template y con DOM, sin agregar globals de Node a otros archivos del proyecto                                                                                                                                                                                                                                                                                                                                                                                                                                            | Usuarios y sistemas afectados; Fuera de alcance (`src/env.ts`); raíz REQ-8 | `constants.test.ts`: sin diagnósticos en `env.ts`; un archivo hermano obtiene TS2591 por `process`; Zod declarado y compatible |

## Diseño

- **`constants.ts`:** `TYPE_CHECKING_OPTIONS`, una lista cerrada de las 20 opciones de
  _Type Checking_ en TypeScript 5.9 más `noCheck`, la única excepción porque apaga el chequeo
  entero. Un comentario explica el porqué; los valores viven en el template.
- **`tsconfig.json` del template:** suma las cuatro opciones de T2. Se sincroniza a
  `packages/strong-mode/template/`.
- **`src/env.ts` del template:** declara `process` localmente para compilar bajo `types: []`; lee `process.env` directamente y sigue siendo Node-only (sin `process`, falla al importar).
- **`merge.ts`**, para `tsconfig.json` y `tsconfig.eslint.json`:
  1. Lee con `parse(texto, errores, { allowTrailingComma: true })` de `jsonc-parser`.
     Cualquier error, o una forma que tsc no aceptaría (T4), devuelve `undefined`.
  2. Calcula el objeto destino con el merge de hoy (`mergeJsonValues`). Después pisa las
     rutas que son del template: `TEMPLATE_OWNED_KEYS` pasa a ser `TEMPLATE_OWNED_PATHS`,
     con rutas como `["compilerOptions", "strict"]`. Para `tsconfig.json` son las de
     `TYPE_CHECKING_OPTIONS`; para `tsconfig.eslint.json`, `["exclude"]`. Una ruta se pisa
     solo si el template la define.
  3. Recorre el objeto destino contra el leído y, por cada clave nueva o con otro valor,
     aplica `modify` + `applyEdits` sobre el texto, con 2 espacios. `jsonc-parser` toma el fin
     de línea del archivo. Si los dos lados son objetos, baja un nivel en vez de reemplazar.
     El merge nunca borra claves, así que alcanza con recorrer el destino.
  4. Devuelve `{ content, raisedOptions }`. `raisedOptions` lista cada ruta de
     `TYPE_CHECKING_OPTIONS` que el proyecto tenía explícita con otro valor (`name`, `from`,
     `to`). `.gitignore` y `.prettierignore` devuelven `raisedOptions: []`.
- **`execute.ts`:** cuando el merge devuelve opciones subidas, avisa con `log.warn`: el
  archivo, cada opción con `from → to`, y que los errores de tipos que aparezcan son
  esperables y se arreglan en el código, no bajando las opciones. Con `--dry-run`, "would
  raise". El aviso sale al mergear, antes de instalar y chequear: si un paso posterior falla,
  solo se imprime el error.
- **Dependencia:** `jsonc-parser@^3.3.1` en `dependencies` del CLI. tsup la deja externa.
- **Decisiones y por qué:**
  - **Usar la categoría de TypeScript:** qué opciones son de chequeo lo decide la
    herramienta ("si su comportamiento y el nuestro difieren, gana el de la herramienta").
    La única excepción es `noCheck`, que apaga el chequeo entero y queda en `false`.
    La lista es cerrada porque el CLI no carga TypeScript en runtime. `skipLibCheck` queda
    afuera: con `false`, un proyecto puede fallar por tipos de `node_modules` que no puede
    arreglar.
  - **`jsonc-parser`:** ni la biblioteca estándar ni las dependencias actuales leen JSON
    con comentarios, y escribir un parser propio contradice "componer, no reimplementar". Es
    de Microsoft (el parser de VS Code), con licencia MIT y sin dependencias.
  - **Editar en el lugar en vez de reescribir:** conserva los comentarios y el formato del
    usuario, que es lo que pide la restricción "en lo demás, no pisar".
  - **El template fija las 21 opciones:** si no, un `false` explícito en
    `strictBuiltinIteratorReturn`, o un `true` en `allowUnreachableCode`, sobreviviría.
    `allowUnreachableCode: false` vuelve error el código inalcanzable, que es código muerto.

## Concerns

- **CF1.** Un proyecto con código que no pasa el modo estricto va a fallar el typecheck
  posterior, y apply termina con error. Es lo esperado (decidido el 2026-10-07): el aviso de
  T6 lo explica antes.
- **CF2.** Lo que `modify` inserta, como los arrays, sale en varias líneas, y Prettier los
  quiere en una. Ya pasa en `main` con `JSON.stringify` (concern de formato del spec raíz).
- **CF3.** Un `tsconfig.eslint.json` propio con opciones laxas, y los tsconfig
  _solution-style_ (Vite: `files: []` con `references`), donde el rigor del raíz no llega a
  `tsconfig.app.json` (paso 3 del plan raíz).
- **CF4.** El build ESM de `jsonc-parser` usa imports sin extensión y Node no lo carga.
  Node usa la entrada CommonJS (`main`), y un import con nombre funcionó en la prueba. Hay
  que verificarlo con el build de tsup y el dry-run.
- **CF5.** Con `allowUnreachableCode: false`, en los proyectos nuevos el código inalcanzable
  pasa a ser error. Es intencional.
