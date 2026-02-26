import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeApplyPlan } from "./execute.js";
import type { ApplyPlan } from "./types.js";

type ConflictPolicy = "review" | "skip" | "overwrite";

const fixtureDir = path.resolve(
  import.meta.dirname,
  "__fixtures__",
  "wizard-base",
);

const createdTempDirs: string[] = [];

const createTempProject = async (): Promise<string> => {
  const tempDirectory = await mkdtemp(path.join(tmpdir(), "zero-ts-wizard-golden-"));
  createdTempDirs.push(tempDirectory);
  await cp(fixtureDir, tempDirectory, { recursive: true });
  return tempDirectory;
};

const makePlan = (): ApplyPlan => ({
  projectName: "demo-app",
  filesToCreate: [
    {
      relativePath: "src/env.ts",
      sourceTemplatePath: "src/env.ts",
      content: 'export const env = { NODE_ENV: "test" } as const;\n',
      exists: false,
    },
  ],
  conflictingFiles: [
    {
      relativePath: "eslint.config.mjs",
      sourceTemplatePath: "eslint.config.mjs",
      content: "export default [\"template-config\"];\n",
      exists: true,
    },
  ],
  packageJsonPlan: {
    path: "package.json",
    exists: true,
    current: {
      name: "demo-app",
      version: "0.0.0",
      private: true,
    },
    next: {
      name: "demo-app",
      version: "0.0.0",
      private: true,
    },
    summary: {
      addedScripts: [],
      updatedScripts: [],
      addedDependencies: [],
      addedDevDependencies: [],
      updatedPrepareScript: false,
      changed: false,
    },
  },
  requiresInstall: false,
});

const readProjectState = async (targetDir: string): Promise<Record<string, string>> => {
  const eslintContent = await readFile(path.join(targetDir, "eslint.config.mjs"), "utf8");
  const envContent = await readFile(path.join(targetDir, "src/env.ts"), "utf8");
  const packageJsonContent = await readFile(path.join(targetDir, "package.json"), "utf8");

  return {
    "eslint.config.mjs": eslintContent,
    "package.json": packageJsonContent,
    "src/env.ts": envContent,
  };
};

afterEach(async (): Promise<void> => {
  await Promise.all(
    createdTempDirs.splice(0).map(async (directory): Promise<void> => {
      await rm(directory, { recursive: true, force: true });
    }),
  );
});

describe("apply wizard golden fixtures", (): void => {
  const expectedByPolicy: Record<
    ConflictPolicy,
    {
      readonly result: {
        readonly createdFiles: readonly string[];
        readonly overwrittenFiles: readonly string[];
        readonly skippedFiles: readonly string[];
        readonly packageJsonUpdated: boolean;
        readonly installRan: boolean;
        readonly checksRan: readonly string[];
      };
      readonly state: Record<string, string>;
    }
  > = {
    skip: {
      result: {
        createdFiles: ["src/env.ts"],
        overwrittenFiles: [],
        skippedFiles: ["eslint.config.mjs"],
        packageJsonUpdated: false,
        installRan: false,
        checksRan: [],
      },
      state: {
        "eslint.config.mjs": "export default [\"custom-local-config\"];\n",
        "package.json": "{\n  \"name\": \"demo-app\",\n  \"version\": \"0.0.0\",\n  \"private\": true\n}\n",
        "src/env.ts": "export const env = { NODE_ENV: \"test\" } as const;\n",
      },
    },
    overwrite: {
      result: {
        createdFiles: ["src/env.ts"],
        overwrittenFiles: ["eslint.config.mjs"],
        skippedFiles: [],
        packageJsonUpdated: false,
        installRan: false,
        checksRan: [],
      },
      state: {
        "eslint.config.mjs": "export default [\"template-config\"];\n",
        "package.json": "{\n  \"name\": \"demo-app\",\n  \"version\": \"0.0.0\",\n  \"private\": true\n}\n",
        "src/env.ts": "export const env = { NODE_ENV: \"test\" } as const;\n",
      },
    },
    review: {
      result: {
        createdFiles: ["src/env.ts"],
        overwrittenFiles: ["eslint.config.mjs"],
        skippedFiles: [],
        packageJsonUpdated: false,
        installRan: false,
        checksRan: [],
      },
      state: {
        "eslint.config.mjs": "export default [\"custom-local-config\", \"template-config\"];\n",
        "package.json": "{\n  \"name\": \"demo-app\",\n  \"version\": \"0.0.0\",\n  \"private\": true\n}\n",
        "src/env.ts": "export const env = { NODE_ENV: \"test\" } as const;\n",
      },
    },
  };

  it.each([
    {
      policy: "skip" as const,
      mergeContent: "unused",
    },
    {
      policy: "overwrite" as const,
      mergeContent: "unused",
    },
    {
      policy: "review" as const,
      mergeContent: "export default [\"custom-local-config\", \"template-config\"];\n",
    },
  ])("produces expected final state for $policy", async ({
    policy,
    mergeContent,
  }: {
    readonly policy: ConflictPolicy;
    readonly mergeContent: string;
  }): Promise<void> => {
    const targetDir = await createTempProject();
    const plan = makePlan();

    const result = await executeApplyPlan(plan, {
      targetDir,
      packageManager: "npm",
      conflictPolicy: policy,
      dryRun: false,
      backup: false,
      shouldInstall: false,
      shouldRunChecks: false,
      conflictResolver: () => Promise.resolve({
        action: "merge",
        content: mergeContent,
      }),
    });

    const state = await readProjectState(targetDir);

    expect(result).toEqual(expectedByPolicy[policy].result);
    expect(state).toEqual(expectedByPolicy[policy].state);
  });
});
