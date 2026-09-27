import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ApplyPlan } from "./types.js";

const { runCommandMock } = vi.hoisted(() => ({ runCommandMock: vi.fn() }));

vi.mock("../process.js", () => ({
  runCommand: runCommandMock,
  runCommandCapture: vi.fn(),
}));
vi.mock("./checks.js", () => ({ runPostApplyChecks: vi.fn().mockReturnValue([]) }));
// The user answers "skip" to every file prompt, including package.json.
vi.mock("./prompts.js", () => ({
  promptFileConflictResolution: vi.fn().mockResolvedValue("skip"),
}));

import { executeApplyPlan } from "./execute.js";

describe("executeApplyPlan when package.json is skipped", (): void => {
  it("does not add lockstep followers to a package.json the user declined to change", async (): Promise<void> => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "strong-mode-execute-skip-"));
    const current = {
      name: "fixture-project",
      private: true,
      devDependencies: { vitest: "3.2.4" },
    };
    await writeFile(
      path.join(tempDir, "package.json"),
      `${JSON.stringify(current, null, 2)}\n`,
    );
    await mkdir(path.join(tempDir, "node_modules/vitest"), { recursive: true });
    await writeFile(
      path.join(tempDir, "node_modules/vitest/package.json"),
      JSON.stringify({ name: "vitest", version: "3.2.4" }),
    );
    const plan: ApplyPlan = {
      projectName: "fixture-project",
      filesToCreate: [],
      conflictingFiles: [],
      packageJsonPlan: {
        path: path.join(tempDir, "package.json"),
        exists: true,
        current,
        next: { ...current, scripts: { check: "npm run lint" } },
        summary: {
          addedScripts: ["check"],
          updatedScripts: [],
          addedDependencies: [],
          addedDevDependencies: [],
          updatedPrepareScript: false,
          postInstallLockstep: ["@vitest/coverage-v8"],
          setModuleType: false,
          changed: true,
        },
      },
      requiresInstall: true,
    };

    const result = await executeApplyPlan(plan, {
      targetDir: tempDir,
      packageManager: "npm",
      yes: false,
      force: false,
      dryRun: false,
      backup: false,
      shouldInstall: true,
      shouldRunChecks: false,
    });

    expect(runCommandMock).toHaveBeenCalledTimes(1);
    expect(runCommandMock).toHaveBeenCalledWith("npm", ["install"], tempDir, "inherit");
    expect(result.packageJsonUpdated).toBe(false);
    expect(result.deferredLockstep).toEqual(["@vitest/coverage-v8"]);
    expect(
      JSON.parse(await readFile(path.join(tempDir, "package.json"), "utf8")),
    ).toEqual(current);
  });
});
