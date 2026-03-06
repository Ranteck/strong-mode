import { describe, expect, it } from "vitest";
import { sanitizePackageName } from "./template.js";

describe("sanitizePackageName", (): void => {
  it("normalizes casing and invalid characters", (): void => {
    expect(sanitizePackageName("My Project/Name")).toBe("my-project-name");
  });

  it("returns an empty string for whitespace-only input", (): void => {
    expect(sanitizePackageName("   ")).toBe("");
  });
});
