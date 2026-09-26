import { describe, expect, it } from "vitest";
import { buildPackageJsonPlan } from "./patchers.js";
import type { PackageJsonLike } from "./types.js";

describe("buildPackageJsonPlan", (): void => {
  it("adds missing strong-mode scripts and dependencies", (): void => {
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
        prepare: "node ./scripts/prepare-hooks.mjs",
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
    expect(plan.next.scripts?.prepare).toBe("node ./scripts/prepare-hooks.mjs");
    expect(plan.summary.addedScripts).toContain("prepare");
  });

  it("merges existing prepare script with the strong-mode hook installer", (): void => {
    const current: PackageJsonLike = {
      scripts: {
        prepare: "husky install",
      },
    };
    const template: PackageJsonLike = {
      scripts: {
        prepare: "node ./scripts/prepare-hooks.mjs",
      },
    };

    const plan = buildPackageJsonPlan("package.json", current, template, "demo");

    expect(plan.next.scripts?.prepare).toBe(
      "husky install && node ./scripts/prepare-hooks.mjs",
    );
    expect(plan.summary.updatedPrepareScript).toBe(true);
  });

  it("does not duplicate the strong-mode hook installer when prepare already contains it", (): void => {
    const current: PackageJsonLike = {
      scripts: {
        prepare: "node ./scripts/prepare-hooks.mjs",
      },
    };
    const template: PackageJsonLike = {
      scripts: {
        prepare: "node ./scripts/prepare-hooks.mjs",
      },
    };

    const plan = buildPackageJsonPlan("package.json", current, template, "demo");

    expect(plan.next.scripts?.prepare).toBe("node ./scripts/prepare-hooks.mjs");
    expect(plan.summary.updatedPrepareScript).toBe(false);
  });

  describe("lockstep dev dependencies", (): void => {
    const template: PackageJsonLike = {
      devDependencies: {
        "@vitest/coverage-v8": "^4.1.8",
        vitest: "^4.1.8",
      },
    };

    it("aligns an added @vitest/coverage-v8 with the project's existing vitest range", (): void => {
      const current: PackageJsonLike = {
        devDependencies: { vitest: "^3.2.0" },
      };

      const plan = buildPackageJsonPlan("package.json", current, template, "demo");

      expect(plan.next.devDependencies?.["@vitest/coverage-v8"]).toBe("^3.2.0");
      expect(plan.next.devDependencies?.vitest).toBe("^3.2.0");
      expect(plan.summary.addedDevDependencies).toContain("@vitest/coverage-v8");
    });

    it("reads the vitest range from dependencies when it is not a dev dependency", (): void => {
      const current: PackageJsonLike = {
        dependencies: { vitest: "~3.1.0" },
      };

      const plan = buildPackageJsonPlan("package.json", current, template, "demo");

      expect(plan.next.devDependencies?.["@vitest/coverage-v8"]).toBe("~3.1.0");
    });

    it("keeps the template ranges when the project has no vitest", (): void => {
      const plan = buildPackageJsonPlan("package.json", {}, template, "demo");

      expect(plan.next.devDependencies?.["@vitest/coverage-v8"]).toBe("^4.1.8");
      expect(plan.next.devDependencies?.vitest).toBe("^4.1.8");
    });

    it("preserves an existing @vitest/coverage-v8", (): void => {
      const current: PackageJsonLike = {
        devDependencies: { "@vitest/coverage-v8": "^2.0.0", vitest: "^3.2.0" },
      };

      const plan = buildPackageJsonPlan("package.json", current, template, "demo");

      expect(plan.next.devDependencies?.["@vitest/coverage-v8"]).toBe("^2.0.0");
      expect(plan.summary.addedDevDependencies).not.toContain("@vitest/coverage-v8");
    });

    it("keeps the template range when vitest uses a protocol specifier", (): void => {
      const current: PackageJsonLike = {
        devDependencies: { vitest: "workspace:*" },
      };

      const plan = buildPackageJsonPlan("package.json", current, template, "demo");

      expect(plan.next.devDependencies?.["@vitest/coverage-v8"]).toBe("^4.1.8");
    });
  });

  it("returns fallback name and module defaults when current is undefined", (): void => {
    const plan = buildPackageJsonPlan("package.json", undefined, {}, "my-app");

    expect(plan.next.name).toBe("my-app");
    expect(plan.next.version).toBe("0.1.0");
    expect(plan.next.type).toBe("module");
    expect(plan.next.private).toBe(true);
  });
});
