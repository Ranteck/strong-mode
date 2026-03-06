import { describe, expect, it } from "vitest";
import { buildPackageJsonPlan } from "./patchers.js";
import type { PackageJsonLike } from "./types.js";

describe("buildPackageJsonPlan", (): void => {
  it("adds missing anti-slop scripts and dependencies", (): void => {
    const current: PackageJsonLike = {
      name: "demo",
      scripts: {
        test: "vitest",
      },
      dependencies: {},
      devDependencies: {},
    };

    const template: PackageJsonLike = {
      scripts: {
        test: "vitest run",
        check: "npm run lint",
        prepare: "lefthook install",
      },
      dependencies: {
        zod: "^3.0.0",
      },
      devDependencies: {
        eslint: "^9.0.0",
      },
      engines: {
        node: ">=22",
      },
    };

    const plan = buildPackageJsonPlan("package.json", current, template, "fallback");

    expect(plan.summary.changed).toBe(true);
    expect(plan.summary.addedScripts).toContain("check");
    // user's existing "test" script must not be overwritten
    expect(plan.summary.updatedScripts).not.toContain("test");
    expect(plan.next.scripts?.test).toBe("vitest");
    expect(plan.summary.addedDependencies).toContain("zod");
    expect(plan.summary.addedDevDependencies).toContain("eslint");
    expect(plan.next.scripts?.prepare).toBe("lefthook install");
    expect(plan.summary.addedScripts).toContain("prepare");
  });

  it("merges existing prepare script with lefthook install", (): void => {
    const current: PackageJsonLike = {
      scripts: {
        prepare: "husky install",
      },
    };
    const template: PackageJsonLike = {
      scripts: {
        prepare: "lefthook install",
      },
    };

    const plan = buildPackageJsonPlan("package.json", current, template, "demo");

    expect(plan.next.scripts?.prepare).toBe("husky install && lefthook install");
    expect(plan.summary.updatedPrepareScript).toBe(true);
  });

  it("does not duplicate lefthook install when prepare already contains it", (): void => {
    const current: PackageJsonLike = {
      scripts: {
        prepare: "lefthook install",
      },
    };
    const template: PackageJsonLike = {
      scripts: {
        prepare: "lefthook install",
      },
    };

    const plan = buildPackageJsonPlan("package.json", current, template, "demo");

    expect(plan.next.scripts?.prepare).toBe("lefthook install");
    expect(plan.summary.updatedPrepareScript).toBe(false);
  });

  it("returns fallback name and module defaults when current is undefined", (): void => {
    const plan = buildPackageJsonPlan("package.json", undefined, {}, "my-app");

    expect(plan.next.name).toBe("my-app");
    expect(plan.next.version).toBe("0.1.0");
    expect(plan.next.type).toBe("module");
    expect(plan.next.private).toBe(true);
  });
});
