import { describe, expect, it } from "vitest";
import { buildApplyPlan } from "./plan.js";
import type { ApplyDetection } from "./detect.js";

describe("buildApplyPlan", (): void => {
  it("splits managed files into create and conflict groups", (): void => {
    const detection: ApplyDetection = {
      projectName: "demo",
      targetPackageJson: {
        name: "demo",
      },
      templatePackageJson: {
        scripts: {
          check: "npm run lint",
        },
      },
      managedFiles: [
        {
          relativePath: "tsconfig.json",
          sourceTemplatePath: "tsconfig.json",
          content: "{}",
          exists: false,
        },
        {
          relativePath: "eslint.config.mjs",
          sourceTemplatePath: "eslint.config.mjs",
          content: "export default [];",
          exists: true,
        },
      ],
    };

    const plan = buildApplyPlan("C:/tmp/demo", detection);

    expect(plan.filesToCreate).toHaveLength(1);
    expect(plan.filesToCreate[0]?.relativePath).toBe("tsconfig.json");
    expect(plan.conflictingFiles).toHaveLength(1);
    expect(plan.conflictingFiles[0]?.relativePath).toBe("eslint.config.mjs");
    expect(plan.projectName).toBe("demo");
  });

  it("sets requiresInstall true when template adds new dependencies", (): void => {
    const detection: ApplyDetection = {
      projectName: "demo",
      targetPackageJson: { name: "demo", devDependencies: {} },
      templatePackageJson: { devDependencies: { eslint: "^9.0.0" } },
      managedFiles: [],
    };

    const plan = buildApplyPlan("/tmp/demo", detection);

    expect(plan.requiresInstall).toBe(true);
  });

  it("sets requiresInstall false when target already has all template dependencies", (): void => {
    const detection: ApplyDetection = {
      projectName: "demo",
      targetPackageJson: { name: "demo", devDependencies: { eslint: "^9.0.0" } },
      templatePackageJson: { devDependencies: { eslint: "^9.0.0" } },
      managedFiles: [],
    };

    const plan = buildApplyPlan("/tmp/demo", detection);

    expect(plan.requiresInstall).toBe(false);
  });
});
