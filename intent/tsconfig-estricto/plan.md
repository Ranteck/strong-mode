# Plan: tsconfig estricto al aplicar (desde intent.md 2026-10-07)

Estado: aceptado

Ejecución: tareas 1–4 implementadas localmente en `feat/strict-tsconfig-merge`, sin
commits ni PR. La tarea 5 (T7, matriz de gestores y entrega) sigue pendiente.

Adaptaciones al plan: se valida `compilerOptions` en ambos archivos de entrada; C10
se registra como resuelto en esta rama, pendiente de merge a `main`. El formato se
verifica solo en los archivos de esta feature para respetar los archivos excluidos
por el usuario. La dependencia se instaló offline desde el cache autorizado.

> **Para quien ejecute:** se implementa con `/graph-engineer` (Codex escribe y critica,
> Claude arbitra), tarea por tarea, en el worktree `~/Proyectos/strong-mode-tsconfig`
> (rama `feat/strict-tsconfig-merge`). Los pasos usan casillas (`- [ ]`).

**Objetivo:** que `npx strong-mode` deje el `tsconfig.json` existente tan estricto como el
del template en las opciones de chequeo, editándolo en el lugar.

**Arquitectura:** una lista cerrada (`TYPE_CHECKING_OPTIONS`) define qué opciones son del
template. `merge.ts` lee el tsconfig con `jsonc-parser`, calcula el merge de hoy más esas
rutas, y escribe solo las diferencias con `modify` + `applyEdits`. Devuelve también las
opciones que subió, y `execute.ts` las avisa.

**Stack:** TypeScript 5.9, Vitest 4, `jsonc-parser` 3.3, `@clack/prompts` (`log.warn`).

**Spec:** [spec.md](spec.md) (T1–T7).

## Restricciones globales

- `jsonc-parser@^3.3.1` en `dependencies` de `packages/strong-mode`; ninguna otra dependencia
  nueva.
- Las 20 opciones, en este orden (el de TypeScript 5.9): `strict`, `noImplicitAny`,
  `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`,
  `strictPropertyInitialization`, `strictBuiltinIteratorReturn`, `noImplicitThis`,
  `useUnknownInCatchVariables`, `alwaysStrict`, `noUnusedLocals`, `noUnusedParameters`,
  `exactOptionalPropertyTypes`, `noImplicitReturns`, `noFallthroughCasesInSwitch`,
  `noUncheckedIndexedAccess`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`,
  `allowUnusedLabels`, `allowUnreachableCode`.
- Texto exacto del aviso: `<archivo>: raised|would raise <opción> (<antes> → <después>), ...
to the strong-mode values. Type errors they reveal in your code are expected; fix the code
rather than lowering the options.`
- Lo insertado va con 2 espacios; el fin de línea lo decide `jsonc-parser` desde el archivo.
- Cada cambio en `packages/scaffold-ultra/template/` o en `README.md` va con
  `npm run sync:template` y la copia sincronizada en el mismo commit.
- Conventional Commits; ningún push, PR ni merge sin confirmación del usuario.

## Archivos que cambian

| Archivo                                                  | Qué                                                                   |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| `packages/strong-mode/src/apply/constants.ts`            | `TYPE_CHECKING_OPTIONS`                                               |
| `packages/strong-mode/src/apply/constants.test.ts`       | el template fija las 20; TypeScript reconoce los nombres              |
| `packages/scaffold-ultra/template/tsconfig.json` (+sync) | las 3 opciones que faltan                                             |
| `packages/strong-mode/package.json`, `package-lock.json` | `jsonc-parser`                                                        |
| `packages/strong-mode/src/apply/merge.ts`                | lectura JSONC, rutas del template, edición en el lugar, `MergeResult` |
| `packages/strong-mode/src/apply/merge.test.ts`           | tests de T1, T3, T4, T5 y T6 (lista)                                  |
| `packages/strong-mode/src/apply/execute.ts`              | usar `MergeResult` y avisar las opciones subidas                      |
| `packages/strong-mode/src/apply/execute.test.ts`         | el aviso y su variante con `--dry-run`                                |
| `README.md` (+sync), `CLAUDE.md`                         | comportamiento nuevo del merge                                        |
| `intent/spec.md`, `intent/plan.md`                       | R2, C10, C14 y C15; el orden de trabajo                               |

## Orden de trabajo

### Tarea 1: las 20 opciones y el template (T2)

**Archivos:** `constants.ts`, `constants.test.ts`, template `tsconfig.json` y su copia.

**Produce:** `export const TYPE_CHECKING_OPTIONS: readonly string[]` en
`packages/strong-mode/src/apply/constants.ts`.

- [x] **Paso 1: test que falla.** En `constants.test.ts`, sumar `TYPE_CHECKING_OPTIONS` al
      import de `./constants.js` y este bloque al final:

```ts
describe("TYPE_CHECKING_OPTIONS", (): void => {
  it("are all set by the template tsconfig.json, which owns their values", (): void => {
    const { compilerOptions } = JSON.parse(
      readFileSync(path.join(resolveTemplateDir(), "tsconfig.json"), "utf8"),
    ) as { compilerOptions: Record<string, unknown> };

    for (const option of TYPE_CHECKING_OPTIONS) {
      expect(typeof compilerOptions[option], option).toBe("boolean");
    }
  });

  it("are compiler options TypeScript recognizes", (): void => {
    const parsed = ts.parseJsonConfigFileContent(
      {
        compilerOptions: Object.fromEntries(
          TYPE_CHECKING_OPTIONS.map((option) => [option, true]),
        ),
        files: ["index.ts"],
      },
      ts.sys,
      os.tmpdir(),
    );

    expect(
      parsed.errors.map((error) =>
        ts.flattenDiagnosticMessageText(error.messageText, "\n"),
      ),
    ).toEqual([]);
  });
});
```

- [x] **Paso 2:** `npm run test -w strong-mode -- src/apply/constants.test.ts` → falla
      (`TYPE_CHECKING_OPTIONS` no existe).
- [x] **Paso 3: implementación.** En `constants.ts`, después de `MANAGED_FILE_DEPENDENCIES`:

```ts
// TypeScript's own "Type Checking" option category (5.9). In tsconfig.json these
// take the template's value even when the project sets them: they are what makes
// the project stricter. The values live in the template; this only names them.
export const TYPE_CHECKING_OPTIONS: readonly string[] = [
  "strict",
  "noImplicitAny",
  "strictNullChecks",
  "strictFunctionTypes",
  "strictBindCallApply",
  "strictPropertyInitialization",
  "strictBuiltinIteratorReturn",
  "noImplicitThis",
  "useUnknownInCatchVariables",
  "alwaysStrict",
  "noUnusedLocals",
  "noUnusedParameters",
  "exactOptionalPropertyTypes",
  "noImplicitReturns",
  "noFallthroughCasesInSwitch",
  "noUncheckedIndexedAccess",
  "noImplicitOverride",
  "noPropertyAccessFromIndexSignature",
  "allowUnusedLabels",
  "allowUnreachableCode",
];
```

En `packages/scaffold-ultra/template/tsconfig.json`: sumar
`"strictBuiltinIteratorReturn": true` después de `"alwaysStrict": true`, y
`"allowUnusedLabels": false` y `"allowUnreachableCode": false` después de
`"noImplicitOverride": true`. Después, `npm run sync:template`.

- [x] **Paso 4:** el mismo comando del paso 2 pasa; `diff -rq packages/scaffold-ultra/template
packages/strong-mode/template` no imprime nada.
- [ ] **Paso 5: commit** `feat(template): set every TypeScript type-checking option`.

### Tarea 2: merge que lee JSONC y edita en el lugar (T1, T3, T4, T5)

**Archivos:** `package.json` del CLI, `package-lock.json`, `merge.ts`, `merge.test.ts`,
`execute.ts` (solo la adaptación al tipo nuevo).

**Consume:** `TYPE_CHECKING_OPTIONS` (tarea 1).

**Produce**, en `merge.ts`:

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

- [x] **Paso 1: dependencia.** `npm install jsonc-parser@^3.3.1 -w strong-mode` (queda en
      `dependencies`).
- [x] **Paso 2: tests que fallan.** En `merge.test.ts`, los tests existentes pasan a leer
      `result?.content`, porque cambia el tipo de retorno; las aserciones no cambian. Los de
      `.gitignore` y `.prettierignore` pasan a
      `expect(result).toEqual({ content: "...", raisedOptions: [] })`. Sumar:

```ts
it("raises the project's explicit type-checking options to the template's values", (): void => {
  const result = mergeManagedFileContent(
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          strict: false,
          noUnusedLocals: false,
          exactOptionalPropertyTypes: true,
          target: "ES2020",
        },
      },
      null,
      2,
    ),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noUnusedLocals: true,
        exactOptionalPropertyTypes: true,
        noUncheckedIndexedAccess: true,
        target: "ES2024",
      },
    }),
  );
  const merged = JSON.parse(result?.content ?? "{}") as {
    compilerOptions?: Record<string, unknown>;
  };

  expect(merged.compilerOptions).toEqual({
    strict: true,
    noUnusedLocals: true,
    exactOptionalPropertyTypes: true,
    target: "ES2020",
    noUncheckedIndexedAccess: true,
  });
  expect(result?.raisedOptions).toEqual([
    { name: "strict", from: false, to: true },
    { name: "noUnusedLocals", from: false, to: true },
  ]);
});

it("keeps extends and the project's options outside the type-checking category", (): void => {
  const result = mergeManagedFileContent(
    "tsconfig.json",
    JSON.stringify({
      extends: "@tsconfig/node22/tsconfig.json",
      compilerOptions: {
        skipLibCheck: true,
        verbatimModuleSyntax: false,
        module: "commonjs",
      },
    }),
    JSON.stringify({
      compilerOptions: {
        skipLibCheck: false,
        verbatimModuleSyntax: true,
        module: "NodeNext",
        strict: true,
      },
    }),
  );
  const merged = JSON.parse(result?.content ?? "{}") as {
    extends?: string;
    compilerOptions?: Record<string, unknown>;
  };

  expect(merged.extends).toBe("@tsconfig/node22/tsconfig.json");
  expect(merged.compilerOptions).toEqual({
    skipLibCheck: true,
    verbatimModuleSyntax: false,
    module: "commonjs",
    strict: true,
  });
  expect(result?.raisedOptions).toEqual([]);
});

it("edits a commented tsconfig in place, keeping its comments, trailing commas and CRLF", (): void => {
  const existing = [
    "{",
    "  // Visit https://aka.ms/tsconfig to read more about this file",
    '  "compilerOptions": {',
    '    "strict": false, // turned off while migrating',
    '    "target": "es2016",',
    "  },",
    "}",
    "",
  ].join("\r\n");

  const result = mergeManagedFileContent(
    "tsconfig.json",
    existing,
    JSON.stringify({ compilerOptions: { strict: true, noImplicitOverride: true } }),
  );
  const content = result?.content ?? "";

  expect(content).toContain(
    "// Visit https://aka.ms/tsconfig to read more about this file",
  );
  expect(content).toContain('"strict": true, // turned off while migrating');
  expect(content).toContain('"target": "es2016",');
  expect(content).toContain('"noImplicitOverride": true');
  expect(content.replaceAll("\r\n", "")).not.toContain("\n");
  expect(result?.raisedOptions).toEqual([{ name: "strict", from: false, to: true }]);
});

it("falls back to conflict markers when compilerOptions is not an object", (): void => {
  expect(
    mergeManagedFileContent(
      "tsconfig.json",
      '{ "compilerOptions": "strict" }',
      '{ "compilerOptions": { "strict": true } }',
    ),
  ).toBeUndefined();
});
```

- [x] **Paso 3:** `npm run test -w strong-mode -- src/apply/merge.test.ts` → fallan los tests
      nuevos y los adaptados (`content` no existe).
- [x] **Paso 4: implementación.** En `merge.ts`:
  - `import { applyEdits, modify, parse, type ModificationOptions, type ParseError } from "jsonc-parser";`
    e `import { TYPE_CHECKING_OPTIONS } from "./constants.js";`.
  - Exportar `RaisedOption` y `MergeResult` (arriba). `isPlainObject`, `cloneJsonValue`,
    `mergeArrayValues` y `mergeJsonValues` no cambian.
  - Reemplazar `parseJsonObject`, `mergeTsconfig` y `TEMPLATE_OWNED_KEYS` por:

```ts
type KeyPath = readonly string[];

const parseJsoncObject = (source: string): Record<string, unknown> | undefined => {
  const errors: ParseError[] = [];
  const parsed: unknown = parse(source, errors, { allowTrailingComma: true });

  return errors.length === 0 && isPlainObject(parsed) ? parsed : undefined;
};

const valueAt = (root: unknown, keyPath: KeyPath): unknown => {
  let value = root;
  for (const key of keyPath) {
    if (!isPlainObject(value)) {
      return undefined;
    }
    value = value[key];
  }

  return value;
};

const isSameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const MODIFY_OPTIONS: ModificationOptions = {
  formattingOptions: { insertSpaces: true, tabSize: 2 },
};

// The merge never removes keys, so walking the target is enough: each new or
// changed value becomes one edit, and comments and formatting elsewhere stay.
const applyDifferences = (
  text: string,
  current: unknown,
  target: unknown,
  keyPath: KeyPath,
): string => {
  if (isPlainObject(current) && isPlainObject(target)) {
    let next = text;
    for (const [key, value] of Object.entries(target)) {
      next = applyDifferences(next, current[key], value, [...keyPath, key]);
    }
    return next;
  }

  return isSameJson(current, target)
    ? text
    : applyEdits(text, modify(text, [...keyPath], target, MODIFY_OPTIONS));
};

const raisedTypeCheckingOptions = (
  current: Record<string, unknown>,
  merged: Record<string, unknown>,
): RaisedOption[] =>
  TYPE_CHECKING_OPTIONS.flatMap((name): RaisedOption[] => {
    const from = valueAt(current, ["compilerOptions", name]);
    const to = valueAt(merged, ["compilerOptions", name]);
    return from === undefined || isSameJson(from, to) ? [] : [{ name, from, to }];
  });

const mergeTsconfig = (
  existingContent: string,
  incomingContent: string,
  templateOwnedPaths: readonly KeyPath[] = [],
): MergeResult | undefined => {
  const current = parseJsoncObject(existingContent);
  const incoming = parseJsoncObject(incomingContent);
  // tsc rejects a compilerOptions that is not an object (null, a string...).
  const compilerOptions = valueAt(current, ["compilerOptions"]);
  if (
    current === undefined ||
    incoming === undefined ||
    (compilerOptions !== undefined && !isPlainObject(compilerOptions))
  ) {
    return undefined;
  }

  const merged = mergeJsonValues(current, incoming);
  if (!isPlainObject(merged)) {
    return undefined;
  }

  for (const ownedPath of templateOwnedPaths) {
    const templateValue = valueAt(incoming, ownedPath);
    const parent = valueAt(merged, ownedPath.slice(0, -1));
    const key = ownedPath.at(-1);
    if (templateValue !== undefined && isPlainObject(parent) && key !== undefined) {
      parent[key] = cloneJsonValue(templateValue);
    }
  }

  return {
    content: applyDifferences(existingContent, current, merged, []),
    raisedOptions: raisedTypeCheckingOptions(current, merged),
  };
};

const TEMPLATE_OWNED_PATHS: Readonly<Record<string, readonly KeyPath[]>> = {
  // The type-checking options are what makes the project stricter, so they take
  // the template's value even when the project sets them (intent/tsconfig-estricto).
  "tsconfig.json": TYPE_CHECKING_OPTIONS.map(
    (option): KeyPath => ["compilerOptions", option],
  ),
  // tsconfig.eslint.json is the program for every file ESLint lints, and `exclude`
  // wins over `include`, so an exclusion kept from the project (for example
  // "tests") would bring back the "file was not found in any project" parsing errors.
  // Files that should not be linted are ignored through .gitignore or the ESLint
  // config instead; `exclude` is the template's.
  "tsconfig.eslint.json": [["exclude"]],
};
```

- `mergeManagedFileContent` devuelve `MergeResult | undefined`: la rama tsconfig pasa
  `TEMPLATE_OWNED_PATHS[relativePath]`, y la de líneas devuelve
  `{ content: mergeGitignore(existingContent, incomingContent), raisedOptions: [] }`.
- En `execute.ts` (`applyConflictingFile`), adaptar al tipo nuevo sin cambiar el
  comportamiento: guardar `const merge = decision === "merge" ? mergeManagedFileContent(...) : undefined;`
  y usar `merge?.content` donde hoy va el resultado del merge.
- [x] **Paso 5:** `npm run test -w strong-mode -- src/apply/merge.test.ts` pasa; después
      `npm run check` (typecheck, lint y todos los tests).
- [ ] **Paso 6: commit** `feat(apply): raise type-checking options and edit tsconfig in place`.

### Tarea 3: el aviso de las opciones subidas (T6)

**Archivos:** `execute.ts`, `execute.test.ts`.

**Consume:** `MergeResult.raisedOptions` y `RaisedOption` (tarea 2).

- [x] **Paso 1: tests que fallan.** En `execute.test.ts`, dentro de
      `describe("executeApplyPlan", ...)`:

```ts
it.each([
  { dryRun: false, verb: "raised", strict: true },
  { dryRun: true, verb: "would raise", strict: false },
])(
  "warns which type-checking options it $verb in tsconfig.json",
  async ({ dryRun, verb, strict }): Promise<void> => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "strong-mode-execute-"));
    await writeFile(
      path.join(tempDir, "tsconfig.json"),
      '{\n  "compilerOptions": { "strict": false }\n}\n',
    );
    const warn = vi.spyOn(log, "warn").mockImplementation((): void => undefined);
    try {
      await executeApplyPlan(
        {
          ...createPlan(tempDir),
          conflictingFiles: [
            {
              relativePath: "tsconfig.json",
              sourceTemplatePath: "/template/tsconfig.json",
              content: '{\n  "compilerOptions": { "strict": true }\n}\n',
              exists: true,
            },
          ],
        },
        {
          targetDir: tempDir,
          packageManager: "npm",
          yes: true,
          force: false,
          dryRun,
          backup: false,
          shouldInstall: false,
          shouldRunChecks: false,
        },
      );

      expect(warn).toHaveBeenCalledWith(
        `tsconfig.json: ${verb} strict (false → true) to the strong-mode values. Type errors they reveal in your code are expected; fix the code rather than lowering the options.`,
      );
      const written = JSON.parse(
        await readFile(path.join(tempDir, "tsconfig.json"), "utf8"),
      ) as { compilerOptions: { strict: boolean } };
      expect(written.compilerOptions.strict).toBe(strict);
    } finally {
      warn.mockRestore();
    }
  },
);
```

- [x] **Paso 2:** `npm run test -w strong-mode -- src/apply/execute.test.ts` → falla (no hay
      aviso).
- [x] **Paso 3: implementación.** En `execute.ts`, importar `type RaisedOption` de
      `./merge.js` y sumar:

```ts
const warnRaisedOptions = (
  relativePath: string,
  raised: readonly RaisedOption[],
  dryRun: boolean,
): void => {
  if (raised.length === 0) {
    return;
  }

  const changes = raised
    .map(
      ({ name, from, to }) =>
        `${name} (${JSON.stringify(from)} → ${JSON.stringify(to)})`,
    )
    .join(", ");
  log.warn(
    `${relativePath}: ${dryRun ? "would raise" : "raised"} ${changes} to the strong-mode values. Type errors they reveal in your code are expected; fix the code rather than lowering the options.`,
  );
};
```

En `applyConflictingFile`, en la rama `decision === "merge"` que hoy hace
`results.mergedFiles.push(...)`, llamar después a
`warnRaisedOptions(managedFile.relativePath, merge?.raisedOptions ?? [], options.dryRun)`.

- [x] **Paso 4:** el comando del paso 2 pasa; después `npm run check`.
- [ ] **Paso 5: commit** `feat(apply): warn which tsconfig options were raised`.

### Tarea 4: documentación y estado del SDLC

**Archivos:** `README.md` (+sync), `CLAUDE.md`, `intent/spec.md`, `intent/plan.md`, este plan.

- [x] **Paso 1: README**, sección "What it installs → TypeScript": reemplazar las dos viñetas
      por:

```markdown
- Every type-checking option TypeScript has (`strict` and its family,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `allowUnreachableCode: false`, …), plus `skipLibCheck: false`
- An existing `tsconfig.json` is edited in place (comments kept): its type-checking options
  are raised to these values, and strong-mode lists each one it raised. Everything else
  keeps the project's value.
```

Después, `npm run sync:template`.

- [x] **Paso 2: `CLAUDE.md`**, en la descripción de `execute.ts`: después de
      "structural merge (the ignore files by lines) via `src/apply/merge.ts`", sumar
      "(tsconfig files are read as JSONC with `jsonc-parser` and edited in place; in
      `tsconfig.json` the `TYPE_CHECKING_OPTIONS` always take the template's value and each
      raised option is warned)".
- [x] **Paso 3: `intent/spec.md`.**
  - R2 pasa a `verificado`, con "Cómo se cumple hoy" actualizado.
  - C10 queda "Resuelto en la rama `feat/strict-tsconfig-merge`, pendiente de merge a `main`" y suma C14 y C15, con el texto de los concerns CF2 y CF3
    de [spec.md](spec.md).
- [x] **Paso 4: `intent/plan.md`.**
  - "Hecho" suma esta implementación local, sin afirmar un PR o merge todavía.
  - C10 sale del orden de trabajo.
  - C14 entra junto con los gates y C15 junto con C11.
- [x] **Paso 5:** Prettier con `--check` sobre los archivos de esta feature; que los links de `intent/` resuelvan.
- [ ] **Paso 6: commit** `docs: document the strict tsconfig merge`.

### Tarea 5: verificación de punta a punta (T7) y entrega

- [ ] **Paso 1:** Definition of Done: `npm run check`,
      `npm run build -w strong-mode && node packages/strong-mode/dist/cli.js --dry-run --yes`
      y `npm run dead-code`.
- [ ] **Paso 2: apply real.**
  - En un directorio del scratchpad: `npm init -y`, `npm pkg set type=module`,
    `npx tsc --init` (TypeScript del repo), poner `"strict": false` en el `tsconfig.json`
    generado, y crear `src/index.ts` con `export const x: number = 1;`.
  - Correr `node <repo>/packages/strong-mode/dist/cli.js --yes`.

  Esperado:
  - el aviso con `strict (false → true)`;
  - el `tsconfig.json` con `"strict": true` y los comentarios de `tsc --init` intactos;
  - sin marcadores de conflicto;
  - el typecheck corre.

- [ ] **Paso 3:** `/e2e-pm-matrix` (toca `src/apply` y el template).
- [ ] **Paso 4:** `/pre-push` (sync del template, Definition of Done y revisión de Codex), y
      recién con confirmación del usuario: push, PR contra `main` y merge.

## Riesgos

- **El tipo de retorno de `mergeManagedFileContent` cambia.** Su único consumidor es
  `execute.ts`; la tarea 2 lo adapta en el mismo commit.
- **El build de `jsonc-parser` (CF4 del spec).** Su build ESM no carga en Node; se usa la
  entrada CommonJS. El dry-run de la tarea 5 corre el CLI empaquetado con la dependencia
  externa.
- **Un proyecto con código laxo termina el apply con error de typecheck** (CF1). Es lo
  esperado, y el aviso sale antes.
- **`allowUnreachableCode: false` en el template** (CF5). Lo verifica el apply real del CI,
  que corre typecheck sobre el proyecto generado.
- **Arrays insertados en varias líneas** (CF2). No es regresión: `main` ya los escribe así.

## Prueba

- Unitarios: `merge.test.ts`, `constants.test.ts` y `execute.test.ts`, mapeados a T1–T6 en
  [spec.md](spec.md).
- `npm run check`, el build con `--dry-run --yes`, `npm run dead-code`, y el template en
  sync.
- El apply real de la tarea 5 (T7) y `/e2e-pm-matrix`.
- La CI del PR: apply real sobre un proyecto nuevo, `check` y `dead-code`.
