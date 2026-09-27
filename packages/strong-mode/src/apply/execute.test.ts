import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplyPlan } from "./types.js";

const { runCommandMock, runPostApplyChecksMock } = vi.hoisted(() => ({
  runCommandMock: vi.fn(),
  runPostApplyChecksMock: vi.fn(),
}));

vi.mock("../process.js", (): { runCommand: typeof runCommandMock } => ({
  runCommand: runCommandMock,
}));

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
  ): ReturnType<typeof executeApplyPlan> =>
    executeApplyPlan(planWithPostInstall(tempDir), {
      targetDir: tempDir,
      packageManager: "npm",
      yes: true,
      force: false,
      dryRun: false,
      backup: false,
      shouldInstall,
      shouldRunChecks: true,
    });

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
      { name: "@vitest/coverage-v8", version: "3.2.4" },
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
