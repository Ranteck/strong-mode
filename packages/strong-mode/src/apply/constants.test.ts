import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import semver from "semver";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { resolveTemplateDir } from "../template.js";
import {
  LOCKSTEP_DEV_DEPENDENCIES,
  MANAGED_FILE_DEPENDENCIES,
  MANAGED_TEMPLATE_FILES,
  REPLACED_DEV_DEPENDENCIES,
  TEMPLATE_PEER_REQUIREMENTS,
} from "./constants.js";

describe("LOCKSTEP_DEV_DEPENDENCIES", (): void => {
  it("satisfies its own peer requirements (TEMPLATE_PEER_REQUIREMENTS)", (): void => {
    const templatePackageJson = JSON.parse(
      readFileSync(path.join(resolveTemplateDir(), "package.json"), "utf8"),
    ) as { devDependencies: Record<string, string> };

    for (const [name, { peer, range }] of Object.entries(TEMPLATE_PEER_REQUIREMENTS)) {
      expect(templatePackageJson.devDependencies[name]).toBeDefined();
      expect(
        semver.subset(templatePackageJson.devDependencies[peer] ?? "", range),
      ).toBe(true);
    }
  });

  it("declares vite, which Vitest 5 needs as a non-optional peer that Yarn does not install", (): void => {
    const templatePackageJson = JSON.parse(
      readFileSync(path.join(resolveTemplateDir(), "package.json"), "utf8"),
    ) as { devDependencies: Record<string, string> };

    expect(templatePackageJson.devDependencies.vitest).toBeDefined();
    expect(templatePackageJson.devDependencies.vite).toBeDefined();
  });

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
  it("leaves knip entry and project detection to its defaults and framework plugins", async (): Promise<void> => {
    const knipConfigModule = (await import(
      path.join(resolveTemplateDir(), "knip.config.ts")
    )) as { default: Record<string, unknown> };
    const knipConfig = knipConfigModule.default;

    expect(knipConfig).not.toHaveProperty("entry");
    expect(knipConfig).not.toHaveProperty("project");
    expect(knipConfig).not.toHaveProperty("ignore");
    expect(knipConfig.ignoreExportsUsedInFile).toBe(false);
  });

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

  it("includes root and nested dot-directories in the ESLint program, but not node_modules", async (): Promise<void> => {
    const projectDir = await mkdtemp(
      path.join(os.tmpdir(), "strong-mode-tsconfig-eslint-"),
    );
    const files = [
      ".storybook/main.ts",
      "packages/web/.storybook/main.ts",
      "src/index.ts",
      "node_modules/.cache/cached.ts",
      "packages/web/node_modules/.cache/cached.ts",
    ];
    for (const file of files) {
      await mkdir(path.dirname(path.join(projectDir, file)), { recursive: true });
      await writeFile(path.join(projectDir, file), "export {};\n");
    }
    await writeFile(
      path.join(projectDir, "tsconfig.json"),
      readTemplate("tsconfig.json"),
    );

    const parsed = ts.parseJsonConfigFileContent(
      JSON.parse(readTemplate("tsconfig.eslint.json")),
      ts.sys,
      projectDir,
    );
    const included = parsed.fileNames.map((file) =>
      path.relative(projectDir, file).split(path.sep).join("/"),
    );

    expect(included).toEqual(
      expect.arrayContaining([
        ".storybook/main.ts",
        "packages/web/.storybook/main.ts",
        "src/index.ts",
      ]),
    );
    expect(included.filter((file) => file.includes("node_modules"))).toEqual([]);
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

describe("MANAGED_FILE_DEPENDENCIES", (): void => {
  it("only links managed files", (): void => {
    const managedTargets = MANAGED_TEMPLATE_FILES.map(
      (file) => file.targetRelativePath,
    );

    for (const [dependent, dependency] of Object.entries(MANAGED_FILE_DEPENDENCIES)) {
      expect(managedTargets).toContain(dependent);
      expect(managedTargets).toContain(dependency);
    }
  });
});
