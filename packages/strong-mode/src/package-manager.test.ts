import { describe, expect, it } from "vitest";
import { addDevDependencyCommand } from "./package-manager.js";

describe("addDevDependencyCommand", (): void => {
  it.each([
    ["npm", ["install", "--save-dev", "--save-exact", "@vitest/coverage-v8@3.2.4"]],
    ["pnpm", ["add", "--save-dev", "--save-exact", "@vitest/coverage-v8@3.2.4"]],
    ["yarn", ["add", "--dev", "--exact", "@vitest/coverage-v8@3.2.4"]],
    ["bun", ["add", "--dev", "--exact", "@vitest/coverage-v8@3.2.4"]],
  ] as const)(
    "adds an exact dev dependency with %s",
    (packageManager, expected): void => {
      expect(
        addDevDependencyCommand(packageManager, "@vitest/coverage-v8@3.2.4"),
      ).toEqual(expected);
    },
  );
});
