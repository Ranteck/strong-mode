const UNSUPPORTED_SHELL = /[|;<>()[\]{}$`'"#\r\n\v\f!*?\\%^~]|(?<!&)&(?!&)/u;
const VITEST_COMMAND =
  /^(?:cross-env[ \t]+)?(?:(?:NODE_ENV|CI|TZ)=[A-Za-z0-9][A-Za-z0-9:._-]*[ \t]+)*vitest(?:[ \t]+(?:run|watch))?(?:[ \t]+(?:--run|--coverage|--passWithNoTests|--silent|--reporter=[A-Za-z0-9][A-Za-z0-9:._-]*))*$/u;
const RUN_SCRIPT =
  /^(?:npm|pnpm|yarn|bun)(?:[ \t]+(?:--silent|-s))?[ \t]+run[ \t]+([A-Za-z0-9][A-Za-z0-9:._-]*)$/u;
const TEST_SCRIPT = /^(?:npm|pnpm|yarn)(?:[ \t]+(?:--silent|-s))?[ \t]+test$/u;
const NAMED_SCRIPT =
  /^(?:pnpm|yarn)[ \t]+([A-Za-z0-9][A-Za-z0-9:._-]*:[A-Za-z0-9:._-]*)$/u;
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
  // An implicit hook can also be delegated to explicitly, with its own hooks.
  const bodies = new Map<string, ScriptResult>();
  const visiting = new Set<string>();
  const visited = new Set<string>();

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
    if (
      typeof body !== "string" ||
      body.length > 4096 ||
      UNSUPPORTED_SHELL.test(body)
    ) {
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

  const hooksRecognized = (current: string): boolean =>
    [`pre${current}`, `post${current}`].every(
      (hook): boolean =>
        !Object.hasOwn(scripts, hook) || evaluateScript(hook, false).recognized,
    );

  const evaluateScript = (current: string, withHooks = true): ScriptResult => {
    const cache = withHooks ? memo : bodies;
    const cached = cache.get(current);
    if (cached !== undefined) {
      return cached;
    }
    if (
      visiting.has(current) ||
      (!visited.has(current) && visited.size >= 32) ||
      !Object.hasOwn(scripts, current)
    ) {
      return UNRECOGNIZED;
    }
    visited.add(current);
    visiting.add(current);
    const body = bodies.get(current) ?? evaluateBody(scripts[current]);
    bodies.set(current, body);
    const result = {
      recognized: body.recognized && (!withHooks || hooksRecognized(current)),
      vitest: body.vitest,
    };
    visiting.delete(current);
    cache.set(current, result);
    return result;
  };

  const result = evaluateScript(name);
  return result.recognized && result.vitest;
};
