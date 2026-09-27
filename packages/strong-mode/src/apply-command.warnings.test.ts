import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type * as ClackPrompts from "@clack/prompts";
import { describe, expect, it, vi } from "vitest";

const { warnMock, executeApplyPlanMock } = vi.hoisted(() => ({
  warnMock: vi.fn(),
  executeApplyPlanMock: vi.fn(),
}));

vi.mock("@clack/prompts", async (importOriginal) => {
  const actual = await importOriginal<typeof ClackPrompts>();
  return { ...actual, log: { ...actual.log, warn: warnMock } };
});

vi.mock("./apply/execute.js", () => ({ executeApplyPlan: executeApplyPlanMock }));

import { runApplyCommand } from "./apply-command.js";

describe("runApplyCommand warnings", (): void => {
  it("warns about deferred lockstep packages before executing, even if execution fails", async (): Promise<void> => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "strong-mode-warnings-"));
    await writeFile(
      path.join(tempDir, "package.json"),
      `${JSON.stringify({ name: "demo", type: "module", devDependencies: { vitest: "catalog:" } }, null, 2)}\n`,
    );
    executeApplyPlanMock.mockRejectedValue(new Error("install failed"));

    await expect(
      runApplyCommand({
        command: "apply",
        cwd: tempDir,
        packageManager: "npm",
        install: true,
        runChecks: true,
        yes: true,
        dryRun: false,
        backup: false,
        force: false,
      }),
    ).rejects.toThrow("install failed");

    expect(warnMock).toHaveBeenCalledWith(
      expect.stringContaining("@vitest/coverage-v8"),
    );
    expect(warnMock.mock.invocationCallOrder[0]).toBeLessThan(
      executeApplyPlanMock.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
