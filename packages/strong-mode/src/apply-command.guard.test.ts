import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@clack/prompts", async (importOriginal) => {
  const actual = await importOriginal<typeof ClackPrompts>();
  const prompted = (): never => {
    throw new Error("prompted before the CommonJS guard");
  };
  return { ...actual, select: prompted, confirm: prompted };
});

import type * as ClackPrompts from "@clack/prompts";
import { runApplyCommand } from "./apply-command.js";

const createCommonJsProject = async (): Promise<string> => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "strong-mode-guard-"));
  await writeFile(
    path.join(tempDir, "package.json"),
    `${JSON.stringify({ name: "legacy", type: "commonjs" }, null, 2)}\n`,
  );
  return tempDir;
};

describe("runApplyCommand CommonJS guard", (): void => {
  it.each([
    ["a dry run", { dryRun: true, yes: true }],
    ["an interactive run without --pm", { dryRun: false, yes: false }],
  ])(
    "rejects a CommonJS project in %s before any prompt or write",
    async (_label: string, flags: { dryRun: boolean; yes: boolean }): Promise<void> => {
      const tempDir = await createCommonJsProject();
      const before = await readFile(path.join(tempDir, "package.json"), "utf8");

      await expect(
        runApplyCommand({
          command: "apply",
          cwd: tempDir,
          install: false,
          runChecks: false,
          backup: false,
          force: false,
          ...flags,
        }),
      ).rejects.toThrow('"type": "commonjs"');
      expect(await readdir(tempDir)).toEqual(["package.json"]);
      expect(await readFile(path.join(tempDir, "package.json"), "utf8")).toBe(before);
    },
  );
});
