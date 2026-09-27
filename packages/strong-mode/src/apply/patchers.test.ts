import { describe, expect, it } from "vitest";
import { buildPackageJsonPlan, dropReplacedDependencies } from "./patchers.js";
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

  it("replaces the npm init placeholder test script with the template's", (): void => {
    const current: PackageJsonLike = {
      scripts: { test: 'echo "Error: no test specified" && exit 1' },
    };
    const template: PackageJsonLike = { scripts: { test: "vitest run" } };

    const plan = buildPackageJsonPlan("package.json", current, template, "demo");

    expect(plan.next.scripts?.test).toBe("vitest run");
    expect(plan.summary.updatedScripts).toContain("test");
  });

  it("keeps a real existing test script", (): void => {
    const current: PackageJsonLike = { scripts: { test: "node --test" } };
    const template: PackageJsonLike = { scripts: { test: "vitest run" } };

    const plan = buildPackageJsonPlan("package.json", current, template, "demo");

    expect(plan.next.scripts?.test).toBe("node --test");
    expect(plan.summary.updatedScripts).not.toContain("test");
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

    it.each([
      ["a semver range", "^3.2.0"],
      ["a catalog specifier", "catalog:"],
      ["an npm alias", "npm:vitest@4.1.8"],
      ["a dist-tag", "latest"],
    ])(
      "leaves coverage for after install when the project declares vitest as %s",
      (_label: string, specifier: string): void => {
        const current: PackageJsonLike = { devDependencies: { vitest: specifier } };

        const plan = buildPackageJsonPlan("package.json", current, template, "demo");

        expect(plan.next.devDependencies).toEqual({ vitest: specifier });
        expect(plan.summary.addedDevDependencies).not.toContain("@vitest/coverage-v8");
        expect(plan.summary.postInstallLockstep).toEqual(["@vitest/coverage-v8"]);
      },
    );

    it("pairs coverage with a vitest declared in dependencies without duplicating it", (): void => {
      const current: PackageJsonLike = { dependencies: { vitest: "~3.1.0" } };

      const plan = buildPackageJsonPlan("package.json", current, template, "demo");

      expect(plan.next.dependencies).toEqual({ vitest: "~3.1.0" });
      expect(plan.next.devDependencies).toEqual({});
      expect(plan.summary.addedDevDependencies).not.toContain("vitest");
      expect(plan.summary.postInstallLockstep).toEqual(["@vitest/coverage-v8"]);
    });

    it("adds both packages from the template when the project has no vitest", (): void => {
      const plan = buildPackageJsonPlan("package.json", {}, template, "demo");

      expect(plan.next.devDependencies?.["@vitest/coverage-v8"]).toBe("^4.1.8");
      expect(plan.next.devDependencies?.vitest).toBe("^4.1.8");
      expect(plan.summary.postInstallLockstep).toEqual([]);
    });

    it("preserves an existing @vitest/coverage-v8", (): void => {
      const current: PackageJsonLike = {
        devDependencies: { "@vitest/coverage-v8": "^2.0.0", vitest: "^3.2.0" },
      };

      const plan = buildPackageJsonPlan("package.json", current, template, "demo");

      expect(plan.next.devDependencies?.["@vitest/coverage-v8"]).toBe("^2.0.0");
      expect(plan.summary.addedDevDependencies).not.toContain("@vitest/coverage-v8");
      expect(plan.summary.postInstallLockstep).toEqual([]);
    });
  });

  it("flags an existing package.json without type that becomes ESM", (): void => {
    const plan = buildPackageJsonPlan("package.json", { name: "legacy" }, {}, "legacy");

    expect(plan.next.type).toBe("module");
    expect(plan.summary.setModuleType).toBe(true);
  });

  it("does not flag a package.json that already declares its type or a new project", (): void => {
    const esm = buildPackageJsonPlan("package.json", { type: "module" }, {}, "demo");
    const fresh = buildPackageJsonPlan("package.json", undefined, {}, "demo");

    expect(esm.summary.setModuleType).toBe(false);
    expect(fresh.summary.setModuleType).toBe(false);
  });

  it("returns fallback name and module defaults when current is undefined", (): void => {
    const plan = buildPackageJsonPlan("package.json", undefined, {}, "my-app");

    expect(plan.next.name).toBe("my-app");
    expect(plan.next.version).toBe("0.1.0");
    expect(plan.next.type).toBe("module");
    expect(plan.next.private).toBe(true);
  });
});

describe("dropReplacedDependencies", (): void => {
  const next: PackageJsonLike = {
    devDependencies: {
      "@eslint-community/eslint-plugin-eslint-comments": "^4.8.1",
      "eslint-plugin-eslint-comments": "^3.2.0",
      vitest: "^4.1.8",
    },
  };

  it("drops a replaced package when its config file ends up with the template", (): void => {
    const result = dropReplacedDependencies(next, new Set(["eslint.config.mjs"]));

    expect(result.dropped).toEqual(["eslint-plugin-eslint-comments"]);
    expect(result.next.devDependencies).toEqual({
      "@eslint-community/eslint-plugin-eslint-comments": "^4.8.1",
      vitest: "^4.1.8",
    });
  });

  it("keeps it while the project's own config may still import it", (): void => {
    const result = dropReplacedDependencies(next, new Set<string>());

    expect(result.dropped).toEqual([]);
    expect(result.next).toBe(next);
  });

  it("keeps it when it is a runtime dependency, which exported code may import", (): void => {
    const runtime: PackageJsonLike = {
      dependencies: { "eslint-plugin-eslint-comments": "^3.2.0" },
      devDependencies: { "@eslint-community/eslint-plugin-eslint-comments": "^4.8.1" },
    };

    const result = dropReplacedDependencies(runtime, new Set(["eslint.config.mjs"]));

    expect(result.dropped).toEqual([]);
    expect(result.next).toBe(runtime);
  });

  it("keeps it when the replacement is not declared", (): void => {
    const withoutReplacement: PackageJsonLike = {
      devDependencies: { "eslint-plugin-eslint-comments": "^3.2.0" },
    };

    const result = dropReplacedDependencies(
      withoutReplacement,
      new Set(["eslint.config.mjs"]),
    );

    expect(result.dropped).toEqual([]);
  });
});
