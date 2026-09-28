import { describe, expect, it } from "vitest";
import { assertEsmProject } from "./module-system.js";

describe("assertEsmProject", (): void => {
  it("rejects a CommonJS project with an actionable message", (): void => {
    expect((): void => {
      assertEsmProject({ type: "commonjs" });
    }).toThrow(/"type": "commonjs".*npm pkg set type=module/su);
  });

  it("accepts an ES module project", (): void => {
    expect((): void => {
      assertEsmProject({ type: "module" });
    }).not.toThrow();
  });

  it("accepts a directory without package.json", (): void => {
    expect((): void => {
      assertEsmProject(undefined);
    }).not.toThrow();
  });

  it("accepts a package.json without a type field", (): void => {
    expect((): void => {
      assertEsmProject({ name: "legacy" });
    }).not.toThrow();
  });
});
