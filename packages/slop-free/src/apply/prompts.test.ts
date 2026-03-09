import { describe, expect, it } from "vitest";
import { promptFileConflictResolution } from "./prompts.js";

describe("promptFileConflictResolution", (): void => {
  it("returns overwrite immediately when force is true for managed files", async (): Promise<void> => {
    const result = await promptFileConflictResolution(
      "tsconfig.json",
      "existing content",
      "incoming content",
      false,
      true,
      "managed-file",
    );
    expect(result).toBe("overwrite");
  });

  it("returns conflict markers immediately when yes is true for managed files", async (): Promise<void> => {
    const result = await promptFileConflictResolution(
      "tsconfig.json",
      "existing content",
      "incoming content",
      true,
      false,
      "managed-file",
    );
    expect(result).toBe("conflict");
  });

  it("returns overwrite immediately when yes is true for package.json", async (): Promise<void> => {
    const result = await promptFileConflictResolution(
      "package.json",
      "existing content",
      "incoming content",
      true,
      false,
      "package-json",
    );
    expect(result).toBe("overwrite");
  });

  it("returns overwrite immediately when both force and yes are true", async (): Promise<void> => {
    const result = await promptFileConflictResolution(
      "tsconfig.json",
      "existing content",
      "incoming content",
      true,
      true,
      "managed-file",
    );
    expect(result).toBe("overwrite");
  });
});
