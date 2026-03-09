import { mkdtemp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runApplyCommand } from "./apply-command.js";

const ANSI_PATTERN = new RegExp(String.raw`\u001B\[[0-9;]*m`, "gu");

const stripAnsi = (value: string): string => value.replaceAll(ANSI_PATTERN, "");

const createExistingProject = async (): Promise<string> => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "slop-free-apply-command-"));
  await mkdir(path.join(tempDir, "src"), { recursive: true });

  await writeFile(
    path.join(tempDir, "package.json"),
    `${JSON.stringify(
      {
        name: "existing-ts-app",
        version: "1.2.3",
        private: true,
        type: "module",
        scripts: {
          build: "tsc -p tsconfig.json",
          test: "node --test",
          dev: "node --watch src/index.ts",
        },
        dependencies: {
          zod: "^3.24.0",
        },
        devDependencies: {
          typescript: "^5.9.3",
        },
      },
      null,
      2,
    )}\n`,
  );

  await writeFile(
    path.join(tempDir, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          outDir: "dist",
        },
        include: ["src"],
      },
      null,
      2,
    )}\n`,
  );

  await writeFile(
    path.join(tempDir, "src/index.ts"),
    "export const greet = (name: string): string => `hello ${name}`;\n",
  );

  return tempDir;
};

describe("runApplyCommand", (): void => {
  it("does not modify an existing project during dry-run", async (): Promise<void> => {
    const tempDir = await createExistingProject();

    const beforeFiles = await readdir(tempDir);
    const beforePackageJson = await readFile(
      path.join(tempDir, "package.json"),
      "utf8",
    );
    const beforeTsconfig = await readFile(path.join(tempDir, "tsconfig.json"), "utf8");

    const lines = await runApplyCommand({
      command: "apply",
      cwd: tempDir,
      packageManager: "npm",
      install: true,
      runChecks: true,
      yes: true,
      dryRun: true,
      backup: true,
      force: false,
    });
    const plainLines = lines.map(stripAnsi);

    expect(plainLines).toContain("Dry-run Result");
    expect(plainLines).toContain("  Merged files: 1");
    expect(plainLines).toContain("  Conflicted files: 0");
    expect(plainLines).toContain("  Install: would run");
    expect(plainLines).toContain("  Checks: would run");
    expect(await readdir(tempDir)).toEqual(beforeFiles);
    expect(await readFile(path.join(tempDir, "package.json"), "utf8")).toBe(
      beforePackageJson,
    );
    expect(await readFile(path.join(tempDir, "tsconfig.json"), "utf8")).toBe(
      beforeTsconfig,
    );
  });

  it("merges package.json and tsconfig.json for an existing project", async (): Promise<void> => {
    const tempDir = await createExistingProject();

    const lines = await runApplyCommand({
      command: "apply",
      cwd: tempDir,
      packageManager: "npm",
      install: false,
      runChecks: false,
      yes: true,
      dryRun: false,
      backup: true,
      force: false,
    });
    const plainLines = lines.map(stripAnsi);

    const packageJson = JSON.parse(
      await readFile(path.join(tempDir, "package.json"), "utf8"),
    ) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      engines: Record<string, string>;
    };

    const tsconfig = await readFile(path.join(tempDir, "tsconfig.json"), "utf8");

    const topLevelFiles = await readdir(tempDir);

    expect(plainLines).toContain("Apply Result");
    expect(plainLines).toContain("  Merged files: 1");
    expect(plainLines).toContain("  Conflicted files: 0");
    expect(plainLines).toContain("  Package.json updated: yes");
    expect(plainLines).toContain("  Install ran: no");
    expect(plainLines).toContain("  Checks ran: none");

    expect(packageJson.scripts.build).toBe("tsc -p tsconfig.json");
    expect(packageJson.scripts.test).toBe("node --test");
    expect(packageJson.scripts.dev).toBe("node --watch src/index.ts");
    expect(packageJson.scripts.check).toContain("npm run typecheck");
    expect(packageJson.dependencies.zod).toBe("^3.24.0");
    expect(packageJson.devDependencies.typescript).toBe("^5.9.3");
    expect(packageJson.devDependencies.eslint).toBeDefined();
    expect(packageJson.devDependencies.vitest).toBeDefined();
    expect(packageJson.engines.node).toBe(">=22");

    const parsedTsconfig = JSON.parse(tsconfig) as {
      compilerOptions?: Record<string, unknown>;
      include?: string[];
      exclude?: string[];
    };

    expect(parsedTsconfig.compilerOptions?.target).toBe("ES2022");
    expect(parsedTsconfig.compilerOptions?.outDir).toBe("dist");
    expect(parsedTsconfig.compilerOptions?.noUncheckedIndexedAccess).toBe(true);
    expect(parsedTsconfig.include).toEqual(["src", "src/**/*"]);
    expect(parsedTsconfig.exclude).toContain("dist");

    expect(
      topLevelFiles.some((file) => file.startsWith("package.json.slop-free-backup.")),
    ).toBe(true);
    expect(
      topLevelFiles.some((file) => file.startsWith("tsconfig.json.slop-free-backup.")),
    ).toBe(true);
    expect(topLevelFiles).toContain("eslint.config.mjs");
    expect(topLevelFiles).toContain("vitest.config.ts");
  });
});
