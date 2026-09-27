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

    it("pairs coverage with a vitest declared in dependencies without duplicating it", (): void => {
      const current: PackageJsonLike = {
        dependencies: { vitest: "~3.1.0" },
      };

      const plan = buildPackageJsonPlan("package.json", current, template, "demo");

      expect(plan.next.dependencies).toEqual({ vitest: "~3.1.0" });
      expect(plan.next.devDependencies).toEqual({ "@vitest/coverage-v8": "~3.1.0" });
      expect(plan.summary.addedDevDependencies).not.toContain("vitest");
    });

    it.each([
      ["a GitHub shorthand", "vitest-dev/vitest#v3.2.0"],
      ["a relative tarball", "./vendor/vitest-3.2.0.tgz"],
      ["a dist-tag", "latest"],
      ["a protocol specifier", "workspace:*"],
    ])(
      "defers coverage instead of guessing when vitest is %s and not installed",
      (_label: string, specifier: string): void => {
        const current: PackageJsonLike = { devDependencies: { vitest: specifier } };

        const plan = buildPackageJsonPlan("package.json", current, template, "demo");

        expect(plan.next.devDependencies).not.toHaveProperty("@vitest/coverage-v8");
        expect(plan.summary.addedDevDependencies).not.toContain("@vitest/coverage-v8");
        expect(plan.summary.deferredLockstep).toEqual(["@vitest/coverage-v8"]);
      },
    );

    it("adds the deferred coverage pinned to vitest once it is installed", (): void => {
      const first = buildPackageJsonPlan(
        "package.json",
        { devDependencies: { vitest: "catalog:" } },
        template,
        "demo",
      );
      const second = buildPackageJsonPlan(
        "package.json",
        first.next,
        template,
        "demo",
        { vitest: { version: "3.2.4", inProject: true } },
      );

      expect(second.next.devDependencies?.["@vitest/coverage-v8"]).toBe("3.2.4");
      expect(second.summary.deferredLockstep).toEqual([]);
    });

    it("does not pin a catalog vitest to a version inherited from the workspace root", (): void => {
      const current: PackageJsonLike = { devDependencies: { vitest: "catalog:" } };

      const plan = buildPackageJsonPlan("package.json", current, template, "app", {
        vitest: { version: "3.2.4", inProject: false },
      });

      expect(plan.next.devDependencies).not.toHaveProperty("@vitest/coverage-v8");
      expect(plan.summary.deferredLockstep).toEqual(["@vitest/coverage-v8"]);
    });

    it("pins a catalog vitest once the package has its own install", (): void => {
      const first = buildPackageJsonPlan(
        "package.json",
        { devDependencies: { vitest: "catalog:" } },
        template,
        "app",
        { vitest: { version: "3.2.4", inProject: false } },
      );
      const second = buildPackageJsonPlan("package.json", first.next, template, "app", {
        vitest: { version: "4.1.8", inProject: true },
      });

      expect(second.next.devDependencies?.["@vitest/coverage-v8"]).toBe("4.1.8");
      expect(second.summary.deferredLockstep).toEqual([]);
    });

    it("accepts a workspace-root vitest that satisfies a semver range", (): void => {
      const current: PackageJsonLike = { devDependencies: { vitest: "^3.2.0" } };

      const plan = buildPackageJsonPlan("package.json", current, template, "app", {
        vitest: { version: "3.2.4", inProject: false },
      });

      expect(plan.next.devDependencies?.["@vitest/coverage-v8"]).toBe("3.2.4");
    });

    it.each([["catalog:"], ["latest"], ["workspace:*"]])(
      "pins coverage to the installed vitest when vitest is declared as %s",
      (specifier: string): void => {
        const current: PackageJsonLike = { devDependencies: { vitest: specifier } };

        const plan = buildPackageJsonPlan("package.json", current, template, "demo", {
          vitest: { version: "3.2.4", inProject: true },
        });

        expect(plan.next.devDependencies?.["@vitest/coverage-v8"]).toBe("3.2.4");
        expect(plan.summary.deferredLockstep).toEqual([]);
      },
    );

    it("pins coverage to the installed vitest when it satisfies the declared range", (): void => {
      const current: PackageJsonLike = { devDependencies: { vitest: "^4.1.0" } };

      const plan = buildPackageJsonPlan("package.json", current, template, "demo", {
        vitest: { version: "4.1.0", inProject: true },
      });

      expect(plan.next.devDependencies?.["@vitest/coverage-v8"]).toBe("4.1.0");
      expect(plan.next.devDependencies?.vitest).toBe("^4.1.0");
    });

    it("ignores an installed vitest that does not satisfy the declared range", (): void => {
      const current: PackageJsonLike = { devDependencies: { vitest: "^3.2.0" } };

      const plan = buildPackageJsonPlan("package.json", current, template, "demo", {
        vitest: { version: "4.1.0", inProject: true },
      });

      expect(plan.next.devDependencies?.["@vitest/coverage-v8"]).toBe("^3.2.0");
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
  });

  it("returns fallback name and module defaults when current is undefined", (): void => {
    const plan = buildPackageJsonPlan("package.json", undefined, {}, "my-app");

    expect(plan.next.name).toBe("my-app");
    expect(plan.next.version).toBe("0.1.0");
    expect(plan.next.type).toBe("module");
    expect(plan.next.private).toBe(true);
  });
});
