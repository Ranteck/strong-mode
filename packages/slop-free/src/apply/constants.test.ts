import { describe, expect, it } from "vitest";
import { MANAGED_TEMPLATE_FILES } from "./constants.js";

describe("MANAGED_TEMPLATE_FILES", (): void => {
  it("includes the package-manager hook wrapper", (): void => {
    expect(MANAGED_TEMPLATE_FILES).toContainEqual({
      sourceRelativePath: "scripts/run-package-manager.sh",
      targetRelativePath: "scripts/run-package-manager.sh",
    });
  });
});
