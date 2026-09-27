const RUNS_VITEST = /\bvitest\b/u;

// A package-manager call to another script: `npm run x`, `npm test`, `pnpm x`,
// `yarn run x`, `bun run x`, with optional flags before the script name.
const SCRIPT_DELEGATION =
  /\b(?:npm|pnpm|yarn|bun)(?:\s+(?:run-script|run))?(?:\s+--?[\w-]+)*\s+([^\s&|;]+)/gu;

// Whether a package.json script runs Vitest, directly or through the scripts it
// delegates to (`"test": "npm run test:unit"`). Delegation cycles stop the search.
export const scriptRunsVitest = (
  scripts: Readonly<Record<string, string>> | undefined,
  name = "test",
): boolean => {
  const runsVitest = (current: string, visited: ReadonlySet<string>): boolean => {
    const script = scripts?.[current];
    if (script === undefined || visited.has(current)) {
      return false;
    }
    if (RUNS_VITEST.test(script)) {
      return true;
    }

    const next = new Set([...visited, current]);
    return [...script.matchAll(SCRIPT_DELEGATION)].some(
      ([, target]) => target !== undefined && runsVitest(target, next),
    );
  };

  return runsVitest(name, new Set());
};
