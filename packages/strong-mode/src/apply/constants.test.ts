import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTemplateDir } from "../template.js";
import {
  LOCKSTEP_DEV_DEPENDENCIES,
  MANAGED_TEMPLATE_FILES,
  REPLACED_DEV_DEPENDENCIES,
} from "./constants.js";

describe("LOCKSTEP_DEV_DEPENDENCIES", (): void => {
  it("pins every lockstep pair to the same range in the template", (): void => {
    const templatePackageJson = JSON.parse(
      readFileSync(path.join(resolveTemplateDir(), "package.json"), "utf8"),
    ) as { devDependencies: Record<string, string> };

    for (const [follower, leader] of Object.entries(LOCKSTEP_DEV_DEPENDENCIES)) {
      expect(templatePackageJson.devDependencies[follower]).toBeDefined();
      expect(templatePackageJson.devDependencies[follower]).toBe(
        templatePackageJson.devDependencies[leader],
      );
    }
  });
});

describe("MANAGED_TEMPLATE_FILES", (): void => {
  it("includes the package-manager hook wrapper", (): void => {
    expect(MANAGED_TEMPLATE_FILES).toContainEqual({
      sourceRelativePath: "scripts/run-package-manager.sh",
      targetRelativePath: "scripts/run-package-manager.sh",
    });
  });

  it("includes the ESLint-only tsconfig used for type-aware linting", (): void => {
    expect(MANAGED_TEMPLATE_FILES).toContainEqual({
      sourceRelativePath: "tsconfig.eslint.json",
      targetRelativePath: "tsconfig.eslint.json",
    });
  });

  it("lints every TypeScript file, whatever the framework layout", (): void => {
    const tsconfigEslint = JSON.parse(
      readFileSync(path.join(resolveTemplateDir(), "tsconfig.eslint.json"), "utf8"),
    ) as { include?: string[] };

    expect(tsconfigEslint.include).toEqual(
      expect.arrayContaining(["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"]),
    );
  });

  it("ships the test for the managed src/env.ts so it does not lower coverage", (): void => {
    expect(MANAGED_TEMPLATE_FILES).toContainEqual({
      sourceRelativePath: "tests/env.test.ts",
      targetRelativePath: "tests/env.test.ts",
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

describe("REPLACED_DEV_DEPENDENCIES", (): void => {
  it("points at managed config files and replacements the template ships", (): void => {
    const templatePackageJson = JSON.parse(
      readFileSync(path.join(resolveTemplateDir(), "package.json"), "utf8"),
    ) as { devDependencies: Record<string, string> };
    const managedTargets = MANAGED_TEMPLATE_FILES.map(
      (file) => file.targetRelativePath,
    );

    for (const [name, { replacement, configFile }] of Object.entries(
      REPLACED_DEV_DEPENDENCIES,
    )) {
      expect(managedTargets).toContain(configFile);
      expect(templatePackageJson.devDependencies[replacement]).toBeDefined();
      expect(templatePackageJson.devDependencies[name]).toBeUndefined();
    }
  });
});

describe("template ESLint config", (): void => {
  const readTemplate = (file: string): string =>
    readFileSync(path.join(resolveTemplateDir(), file), "utf8");

  it("points type-aware linting at a managed tsconfig", (): void => {
    const project = /project:\s*"\.\/([^"]+)"/u.exec(
      readTemplate("eslint.config.mjs"),
    )?.[1];

    expect(MANAGED_TEMPLATE_FILES.map((file) => file.targetRelativePath)).toContain(
      project,
    );
  });

  it("includes dot-directories such as .storybook in the ESLint program", (): void => {
    const tsconfigEslint = JSON.parse(readTemplate("tsconfig.eslint.json")) as {
      include?: string[];
    };

    expect(tsconfigEslint.include).toEqual(
      expect.arrayContaining([
        ".*/**/*.ts",
        ".*/**/*.tsx",
        ".*/**/*.mts",
        ".*/**/*.cts",
      ]),
    );
  });

  it("respects .gitignore, lints JS without type information and lints TS scripts", (): void => {
    const eslintConfig = readTemplate("eslint.config.mjs");

    expect(eslintConfig).toContain("includeIgnoreFile(");
    expect(eslintConfig).toContain("disableTypeChecked");
    expect(eslintConfig).toContain('"scripts/**/*.{js,mjs,cjs}"');
    expect(eslintConfig).not.toContain('"scripts/**",');
  });

  it("declares every package the ESLint config imports", (): void => {
    const templatePackageJson = JSON.parse(readTemplate("package.json")) as {
      devDependencies: Record<string, string>;
    };
    const imported = [...readTemplate("eslint.config.mjs").matchAll(/from "([^"]+)"/gu)]
      .map((match) => match[1] ?? "")
      .filter(
        (specifier) => !specifier.startsWith("node:") && !specifier.startsWith("."),
      );

    for (const specifier of imported) {
      expect(templatePackageJson.devDependencies).toHaveProperty([specifier]);
    }
  });
});
