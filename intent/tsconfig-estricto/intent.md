# Intención: tsconfig estricto al aplicar (C10)

Autor: Denis Hugo Perafan · Estado: aceptado · Fecha: 2026-10-07

## Problema

Al aplicar strong-mode sobre un proyecto existente, el merge de `tsconfig.json` conserva los
valores que el proyecto ya tenía: un `"strict": false` o una opción de chequeo apagada
siguen igual, y el proyecto no queda más estricto. Además, si el `tsconfig.json` tiene
comentarios, como el que genera `tsc --init`, el merge no lo puede leer y lo deja con
marcadores de conflicto. Con eso se saltean la instalación y los chequeos.

## Resultado esperado

Después de `npx strong-mode`, el `tsconfig.json` de un proyecto existente queda tan estricto
como el del template en las opciones de chequeo de tipos ("Gana el template"). El resto de
su configuración, sus comentarios y su formato quedan ("Leer y editar en el lugar").
strong-mode avisa qué opciones subió y desde qué valor. Si el código tiene errores con el
modo estricto, el typecheck los muestra: son los errores que la herramienta vino a
encontrar.

## Usuarios y sistemas afectados

- Quien aplica strong-mode a un proyecto TypeScript existente que ya tiene `tsconfig.json`.
- El merge estructural de `tsconfig.json` y `tsconfig.eslint.json`, y el `tsconfig.json` del
  template, que se aplica también a los proyectos nuevos.

## Restricciones

- Del intent raíz: "Volver más estricto cualquier proyecto de TypeScript, como es el modelo
  del modo estricto de TypeScript."
- Componer, no reimplementar: qué opciones son de chequeo lo define TypeScript (su categoría
  _Type Checking_), y leer y editar JSON con comentarios lo hace `jsonc-parser`.
- En todo lo demás, no pisar el trabajo del usuario: las otras opciones, los comentarios y el
  formato quedan. Las opciones de chequeo son la excepción, decidida el 2026-10-07.

## Fuera de alcance

- Que los archivos mergeados pasen `prettier --check` (C14 en el spec raíz, arreglo aparte).
- Un `tsconfig.eslint.json` propio con opciones laxas, y los tsconfig _solution-style_ con
  `references` (C15, junto con C11).
- Las opciones fuera de la categoría _Type Checking_ (`skipLibCheck`,
  `verbatimModuleSyntax`, `isolatedModules`): si el proyecto las fija, conserva su valor.

## Preguntas abiertas

- ¿Hace falta un gate que falle si alguien, o una IA, vuelve a bajar las opciones de
  chequeo después del apply? Apagar `strict` para que compile es un escape típico.

## Cambios

<!-- AAAA-MM-DD: qué cambió y por qué (aprobado por el usuario) -->
