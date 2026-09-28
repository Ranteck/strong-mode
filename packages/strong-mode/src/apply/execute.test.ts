import { mkdtemp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplyPlan } from "./types.js";

const { runCommandMock, runCommandCaptureMock, runPostApplyChecksMock } = vi.hoisted(
  () => ({
    runCommandMock: vi.fn(),
    runCommandCaptureMock: vi.fn(),
    runPostApplyChecksMock: vi.fn(),
  }),
);

vi.mock(
  "../process.js",
  (): {
    runCommand: typeof runCommandMock;
    runCommandCapture: typeof runCommandCaptureMock;
  } => ({
    runCommand: runCommandMock,
    runCommandCapture: runCommandCaptureMock,
  }),
);

vi.mock("./checks.js", (): { runPostApplyChecks: typeof runPostApplyChecksMock } => ({
  runPostApplyChecks: runPostApplyChecksMock,
}));

import { executeApplyPlan } from "./execute.js";

const createPlan = (targetDir: string): ApplyPlan => ({
  projectName: "fixture-project",
  filesToCreate: [],
  conflictingFiles: [
    {
      relativePath: "eslint.config.mjs",
      sourceTemplatePath: "/template/eslint.config.mjs",
      content: "export default [];\n",
      exists: true,
    },
  ],
  packageJsonPlan: {
    path: path.join(targetDir, "package.json"),
    exists: true,
    current: {
      name: "fixture-project",
      private: true,
    },
    next: {
      name: "fixture-project",
      private: true,
    },
    summary: {
      addedScripts: [],
      updatedScripts: [],
      addedDependencies: [],
      addedDevDependencies: [],
      updatedPrepareScript: false,
      postInstallLockstep: [],
      changed: false,
    },
  },
  requiresInstall: false,
});

describe("executeApplyPlan", (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  it("writes conflict markers and suppresses install/checks when conflicts remain", async (): Promise<void> => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "strong-mode-execute-"));
    await mkdir(path.join(tempDir, "src"), { recursive: true });
    await writeFile(
      path.join(tempDir, "package.json"),
      '{\n  "name": "fixture-project",\n  "private": true\n}\n',
    );
    await writeFile(
      path.join(tempDir, "eslint.config.mjs"),
      "export default [{ rules: { semi: 'error' } }];\n",
    );

    const result = await executeApplyPlan(createPlan(tempDir), {
      targetDir: tempDir,
      packageManager: "npm",
      yes: true,
      force: false,
      dryRun: false,
      backup: false,
      shouldInstall: true,
      shouldRunChecks: true,
    });

    const eslintConfig = await readFile(
      path.join(tempDir, "eslint.config.mjs"),
      "utf8",
    );

    expect(result.conflictedFiles).toEqual(["eslint.config.mjs"]);
    expect(result.mergedFiles).toEqual([]);
    expect(result.overwrittenFiles).toEqual([]);
    expect(result.skippedFiles).toEqual([]);
    expect(result.installRan).toBe(false);
    expect(result.checksRan).toEqual([]);
    expect(eslintConfig).toContain("<<<<<<< current project");
    expect(eslintConfig).toContain("semi: 'error'");
    expect(eslintConfig).toContain("export default []");
    expect(eslintConfig).toContain(">>>>>>> strong-mode template");
    expect(runCommandMock).not.toHaveBeenCalled();
    expect(runPostApplyChecksMock).not.toHaveBeenCalled();
  });
});

describe("executeApplyPlan post-install lockstep alignment", (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  const planWithPostInstall = (tempDir: string): ApplyPlan => {
    const base = createPlan(tempDir);
    return {
      ...base,
      conflictingFiles: [],
      packageJsonPlan: {
        ...base.packageJsonPlan,
        summary: {
          ...base.packageJsonPlan.summary,
          postInstallLockstep: ["@vitest/coverage-v8"],
        },
      },
    };
  };

  const createInstalledProject = async (vitestVersion?: string): Promise<string> => {
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "strong-mode-execute-lockstep-"),
    );
    await writeFile(
      path.join(tempDir, "package.json"),
      '{\n  "name": "fixture-project",\n  "private": true\n}\n',
    );
    if (vitestVersion !== undefined) {
      await mkdir(path.join(tempDir, "node_modules/vitest"), { recursive: true });
      await writeFile(
        path.join(tempDir, "node_modules/vitest/package.json"),
        JSON.stringify({ name: "vitest", version: vitestVersion }),
      );
    }
    return tempDir;
  };

  const execute = async (
    tempDir: string,
    shouldInstall: boolean,
    extra: {
      readonly packageManager?: "npm" | "pnpm" | "yarn";
      readonly backup?: boolean;
    } = {},
  ): ReturnType<typeof executeApplyPlan> =>
    executeApplyPlan(planWithPostInstall(tempDir), {
      targetDir: tempDir,
      packageManager: extra.packageManager ?? "npm",
      yes: true,
      force: false,
      dryRun: false,
      backup: extra.backup ?? false,
      shouldInstall,
      shouldRunChecks: true,
    });

  const writeInstalledCoverage = async (
    tempDir: string,
    version: string,
  ): Promise<void> => {
    await mkdir(path.join(tempDir, "node_modules/@vitest/coverage-v8"), {
      recursive: true,
    });
    await writeFile(
      path.join(tempDir, "node_modules/@vitest/coverage-v8/package.json"),
      JSON.stringify({ name: "@vitest/coverage-v8", version }),
    );
  };

  it("verifies the installed pair after adding coverage", async (): Promise<void> => {
    const tempDir = await createInstalledProject("3.2.4");
    await writeInstalledCoverage(tempDir, "3.2.4");

    const result = await execute(tempDir, true);

    expect(result.alignedLockstep).toEqual([
      { name: "@vitest/coverage-v8", version: "3.2.4", verified: true },
    ]);
    expect(result.mismatchedLockstep).toEqual([]);
  });

  it("reports a mismatch instead of alignment when the installed pair differs", async (): Promise<void> => {
    const tempDir = await createInstalledProject("3.2.4");
    await writeInstalledCoverage(tempDir, "3.2.3");

    const result = await execute(tempDir, true);

    expect(result.alignedLockstep).toEqual([]);
    expect(result.mismatchedLockstep).toEqual([
      { name: "@vitest/coverage-v8", leaderVersion: "3.2.4", followerVersion: "3.2.3" },
    ]);
  });

  it("opts into the workspace root when adding at a pnpm workspace root", async (): Promise<void> => {
    const tempDir = await createInstalledProject("3.2.4");
    await writeFile(
      path.join(tempDir, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*\n",
    );

    await execute(tempDir, true, { packageManager: "pnpm" });

    expect(runCommandMock).toHaveBeenNthCalledWith(
      2,
      "pnpm",
      [
        "add",
        "--save-dev",
        "--save-exact",
        "--workspace-root",
        "@vitest/coverage-v8@3.2.4",
      ],
      tempDir,
      "inherit",
    );
  });

  it("backs up package.json before adding coverage", async (): Promise<void> => {
    const tempDir = await createInstalledProject("3.2.4");

    await execute(tempDir, true, { backup: true });

    expect(
      (await readdir(tempDir)).some((name) =>
        name.startsWith("package.json.strong-mode-backup."),
      ),
    ).toBe(true);
  });

  it("resolves vitest through yarn node when Node resolution fails (Yarn PnP)", async (): Promise<void> => {
    const tempDir = await createInstalledProject();
    runCommandCaptureMock.mockReturnValue(
      "yarn node v1.22.22\nstrong-mode-version=4.1.0\nDone in 0.03s.",
    );

    const result = await execute(tempDir, true, { packageManager: "yarn" });

    expect(runCommandCaptureMock).toHaveBeenCalledWith(
      "yarn",
      ["node", "-p", expect.stringContaining("vitest/package.json")],
      tempDir,
    );
    expect(runCommandMock).toHaveBeenNthCalledWith(
      2,
      "yarn",
      ["add", "--dev", "--exact", "@vitest/coverage-v8@4.1.0"],
      tempDir,
      "inherit",
    );
    expect(result.alignedLockstep).toEqual([
      { name: "@vitest/coverage-v8", version: "4.1.0", verified: true },
    ]);
  });

  it.each([
    ["only the yarn banner", "yarn node v1.22.22\nDone in 0.03s."],
    ["a package without a version", "strong-mode-version=undefined"],
  ])(
    "defers coverage when yarn node prints %s",
    async (_label: string, output: string): Promise<void> => {
      const tempDir = await createInstalledProject();
      runCommandCaptureMock.mockReturnValue(output);

      const result = await execute(tempDir, true, { packageManager: "yarn" });

      expect(runCommandMock).toHaveBeenCalledTimes(1);
      expect(result.alignedLockstep).toEqual([]);
      expect(result.deferredLockstep).toEqual(["@vitest/coverage-v8"]);
    },
  );

  it("adds coverage pinned to the installed vitest right after install, before the checks", async (): Promise<void> => {
    const tempDir = await createInstalledProject("3.2.4");
    runPostApplyChecksMock.mockReturnValue(["test"]);

    const result = await execute(tempDir, true);

    expect(runCommandMock).toHaveBeenNthCalledWith(
      1,
      "npm",
      ["install"],
      tempDir,
      "inherit",
    );
    expect(runCommandMock).toHaveBeenNthCalledWith(
      2,
      "npm",
      ["install", "--save-dev", "--save-exact", "@vitest/coverage-v8@3.2.4"],
      tempDir,
      "inherit",
    );
    expect(runCommandMock.mock.invocationCallOrder[1]).toBeLessThan(
      runPostApplyChecksMock.mock.invocationCallOrder[0] ?? 0,
    );
    expect(result.alignedLockstep).toEqual([
      { name: "@vitest/coverage-v8", version: "3.2.4", verified: false },
    ]);
    expect(result.deferredLockstep).toEqual([]);
  });

  it("defers coverage when dependencies are not installed", async (): Promise<void> => {
    const tempDir = await createInstalledProject("3.2.4");

    const result = await execute(tempDir, false);

    expect(runCommandMock).not.toHaveBeenCalled();
    expect(result.alignedLockstep).toEqual([]);
    expect(result.deferredLockstep).toEqual(["@vitest/coverage-v8"]);
  });

  it("defers coverage when the installed vitest cannot be resolved", async (): Promise<void> => {
    const tempDir = await createInstalledProject();

    const result = await execute(tempDir, true);

    expect(runCommandMock).toHaveBeenCalledTimes(1);
    expect(result.alignedLockstep).toEqual([]);
    expect(result.deferredLockstep).toEqual(["@vitest/coverage-v8"]);
  });
});
