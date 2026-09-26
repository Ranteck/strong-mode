import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTemplateDir } from "../template.js";
import { MANAGED_TEMPLATE_FILES } from "./constants.js";

describe("MANAGED_TEMPLATE_FILES", (): void => {
  it("includes the package-manager hook wrapper", (): void => {
    expect(MANAGED_TEMPLATE_FILES).toContainEqual({
      sourceRelativePath: "scripts/run-package-manager.sh",
      targetRelativePath: "scripts/run-package-manager.sh",
    });
  });

  it("manages every local script referenced by template package.json and lefthook.yml", (): void => {
    const referencedScripts = ["package.json", "lefthook.yml"].flatMap((file) =>
      [
        ...readFileSync(path.join(resolveTemplateDir(), file), "utf8").matchAll(
          /\.\/(scripts\/[\w.-]+)/g,
        ),
      ].map((match) => match[1]),
    );
    const managedTargets = MANAGED_TEMPLATE_FILES.map(
      (file) => file.targetRelativePath,
    );

    expect(referencedScripts.length).toBeGreaterThan(0);
    for (const script of referencedScripts) {
      expect(managedTargets).toContain(script);
    }
  });
});
