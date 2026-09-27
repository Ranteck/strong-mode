import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readInstalledVersions } from "./detect.js";

const writeVitestManifest = async (dir: string, manifest: string): Promise<void> => {
  await mkdir(path.join(dir, "node_modules/vitest"), { recursive: true });
  await writeFile(path.join(dir, "node_modules/vitest/package.json"), manifest);
};

// A project root: the lockfile marks where the node_modules search stops.
const createProject = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "strong-mode-detect-"));
  await writeFile(path.join(dir, "package-lock.json"), "{}\n");
  return dir;
};

describe("readInstalledVersions", (): void => {
  it("reads the installed vitest version", async (): Promise<void> => {
    const dir = await createProject();
    await writeVitestManifest(dir, '{ "name": "vitest", "version": "4.1.0" }\n');

    expect(await readInstalledVersions(dir)).toEqual({
      vitest: { version: "4.1.0", inProject: true },
    });
  });

  it("returns nothing when vitest is not installed", async (): Promise<void> => {
    expect(await readInstalledVersions(await createProject())).toEqual({});
  });

  it.each([
    ["truncated JSON", '{ "name": "vitest", "version": '],
    ["an array", "[]"],
    ["a numeric version", '{ "version": 4 }'],
    ["a non-semver version", '{ "version": "latest" }'],
  ])(
    "ignores a vitest manifest with %s instead of failing",
    async (_label: string, manifest: string): Promise<void> => {
      const dir = await createProject();
      await writeVitestManifest(dir, manifest);

      expect(await readInstalledVersions(dir)).toEqual({});
    },
  );

  it("finds vitest hoisted to the workspace root", async (): Promise<void> => {
    const root = await createProject();
    await writeVitestManifest(root, '{ "version": "3.2.4" }\n');
    const app = path.join(root, "packages/app");
    await mkdir(app, { recursive: true });

    expect(await readInstalledVersions(app)).toEqual({
      vitest: { version: "3.2.4", inProject: false },
    });
  });

  it("does not look past the project root", async (): Promise<void> => {
    const outside = await mkdtemp(path.join(os.tmpdir(), "strong-mode-detect-outer-"));
    await writeVitestManifest(outside, '{ "version": "3.2.4" }\n');
    const project = path.join(outside, "project");
    await mkdir(path.join(project, ".git"), { recursive: true });

    expect(await readInstalledVersions(project)).toEqual({});
  });
});
