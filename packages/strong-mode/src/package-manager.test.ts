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

describe("addDevDependencyCommand at a workspace root", (): void => {
  const spec = "@vitest/coverage-v8@3.2.4";

  it.each([
    ["pnpm", false, ["add", "--save-dev", "--save-exact", "--workspace-root", spec]],
    ["yarn", false, ["add", "--dev", "--exact", "--ignore-workspace-root-check", spec]],
    ["yarn", true, ["add", "--dev", "--exact", spec]],
    ["npm", false, ["install", "--save-dev", "--save-exact", spec]],
    ["bun", false, ["add", "--dev", "--exact", spec]],
  ] as const)(
    "uses the root opt-in %s needs (yarn berry: %s)",
    (packageManager, yarnBerry, expected): void => {
      expect(
        addDevDependencyCommand(packageManager, spec, {
          workspaceRoot: true,
          yarnBerry,
        }),
      ).toEqual(expected);
    },
  );

  it("adds no root flag inside a workspace member", (): void => {
    expect(
      addDevDependencyCommand("pnpm", spec, { workspaceRoot: false, yarnBerry: false }),
    ).toEqual(["add", "--save-dev", "--save-exact", spec]);
  });
});
