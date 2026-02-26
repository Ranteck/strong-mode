import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runDoctorCommand } from "./doctor-command.js";

describe("runDoctorCommand", (): void => {
  it("returns a report with summary lines", async (): Promise<void> => {
    const tempDirectory = await mkdtemp(path.join(tmpdir(), "zero-ts-doctor-"));

    try {
      const result = await runDoctorCommand({
        command: "doctor",
        cwd: tempDirectory,
      });

      expect(result.lines.some((line) => line.startsWith("Doctor report:"))).toBe(true);
      expect(result.lines.some((line) => line.startsWith("Summary:"))).toBe(true);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("fails when target directory is not writable/non-existent", async (): Promise<void> => {
    const result = await runDoctorCommand({
      command: "doctor",
      cwd: path.join(tmpdir(), "zero-ts-missing", "path"),
      packageManager: "npm",
    });

    expect(result.exitCode).toBe(1);
    expect(result.lines.some((line) => line.includes("Cannot write in directory"))).toBe(true);
  });

  it("fails when target path points to a writable file", async (): Promise<void> => {
    const tempDirectory = await mkdtemp(path.join(tmpdir(), "zero-ts-doctor-file-"));
    const targetFilePath = path.join(tempDirectory, "workspace.txt");

    try {
      await writeFile(targetFilePath, "workspace");

      const result = await runDoctorCommand({
        command: "doctor",
        cwd: targetFilePath,
        packageManager: "npm",
      });

      expect(result.exitCode).toBe(1);
      expect(result.lines.some((line) => line.includes("Cannot write in directory"))).toBe(true);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });
});
