import { describe, expect, it } from "vitest";
import { promptFileConflictResolution } from "./prompts.js";

describe("promptFileConflictResolution", (): void => {
  it("returns overwrite immediately when force is true", async (): Promise<void> => {
    const result = await promptFileConflictResolution(
      "tsconfig.json",
      "existing content",
      "incoming content",
      false,
      true,
    );
    expect(result).toBe("overwrite");
  });

  it("returns overwrite immediately when yes is true", async (): Promise<void> => {
    const result = await promptFileConflictResolution(
      "tsconfig.json",
      "existing content",
      "incoming content",
      true,
      false,
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
    );
    expect(result).toBe("overwrite");
  });
});
