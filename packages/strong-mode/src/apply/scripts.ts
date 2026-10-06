const UNSUPPORTED_SHELL = /[|;<>()[\]{}$`'"#\r\n\v\f!*?\\]|(?<!&)&(?!&)/u;
const VITEST_COMMAND =
  /^(?:cross-env[ \t]+)?(?:(?:NODE_ENV|CI|TZ)=[^ \t]*[ \t]+)*vitest(?:[ \t]+(?:run|watch))?(?:[ \t]+(?:--run|--coverage|--passWithNoTests|--silent|--reporter=[^ \t]+))*$/u;
const RUN_SCRIPT =
  /^(?:npm|pnpm|yarn|bun)(?:[ \t]+(?:--silent|-s))?[ \t]+run[ \t]+([^ \t]+)$/u;
const TEST_SCRIPT = /^(?:npm|pnpm|yarn)(?:[ \t]+(?:--silent|-s))?[ \t]+test$/u;
const NAMED_SCRIPT = /^(?:pnpm|yarn)[ \t]+([^ \t]*:[^ \t]*)$/u;
const PREPARATION = /^(?:tsc|eslint|prettier)(?:[ \t]|$)/u;

interface ScriptResult {
  readonly recognized: boolean;
  readonly vitest: boolean;
}

const UNRECOGNIZED: ScriptResult = { recognized: false, vitest: false };

const delegatedScript = (command: string): string | undefined =>
  RUN_SCRIPT.exec(command)?.[1] ??
  NAMED_SCRIPT.exec(command)?.[1] ??
  (TEST_SCRIPT.test(command) ? "test" : undefined);

// A false negative only skips the sample; unknown commands must not expose a
// Vitest-only test to another runner. Keep this grammar deliberately closed.
export const scriptRunsVitest = (
  scripts: Readonly<Record<string, string>> | undefined,
  name = "test",
): boolean => {
  if (scripts === undefined) {
    return false;
  }
  const memo = new Map<string, ScriptResult>();
  const visiting = new Set<string>();
  let visited = 0;

  const evaluateCommand = (command: string): ScriptResult => {
    if (VITEST_COMMAND.test(command)) {
      return { recognized: true, vitest: true };
    }
    if (PREPARATION.test(command)) {
      return { recognized: true, vitest: false };
    }
    const target = delegatedScript(command);
    return target === undefined ? UNRECOGNIZED : evaluateScript(target);
  };

  const evaluateBody = (body: unknown): ScriptResult => {
    if (typeof body !== "string" || UNSUPPORTED_SHELL.test(body)) {
      return UNRECOGNIZED;
    }
    let vitest = false;
    for (const command of body.split("&&")) {
      const result = evaluateCommand(command.replace(/^[ \t]+|[ \t]+$/gu, ""));
      if (!result.recognized) {
        return UNRECOGNIZED;
      }
      vitest ||= result.vitest;
    }
    return { recognized: true, vitest };
  };

  const evaluateScript = (current: string): ScriptResult => {
    const cached = memo.get(current);
    if (cached !== undefined) {
      return cached;
    }
    if (visiting.has(current) || visited >= 32 || !Object.hasOwn(scripts, current)) {
      return UNRECOGNIZED;
    }
    visited += 1;
    visiting.add(current);
    let result = evaluateBody(scripts[current]);
    for (const hook of [`pre${current}`, `post${current}`]) {
      if (!Object.hasOwn(scripts, hook)) {
        continue;
      }
      const hookResult = evaluateScript(hook);
      result = {
        recognized: result.recognized && hookResult.recognized,
        vitest: result.vitest || hookResult.vitest,
      };
    }
    visiting.delete(current);
    memo.set(current, result);
    return result;
  };

  const result = evaluateScript(name);
  return result.recognized && result.vitest;
};
