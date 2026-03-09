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
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "slop-free-execute-"));
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
    expect(eslintConfig).toContain(">>>>>>> slop-free template");
    expect(runCommandMock).not.toHaveBeenCalled();
    expect(runPostApplyChecksMock).not.toHaveBeenCalled();
  });
});
