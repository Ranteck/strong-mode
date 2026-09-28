import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertCompatiblePeers } from "./peer-compat.js";
import type { PackageJsonLike } from "./types.js";

const template: PackageJsonLike = {
  devDependencies: { vite: "^8.3.1", vitest: "^5.0.2" },
};

const createProject = async (installedVite?: string): Promise<string> => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), "strong-mode-peer-compat-"));
  await writeFile(path.join(projectDir, "package.json"), '{ "name": "demo" }\n');
  if (installedVite !== undefined) {
    await mkdir(path.join(projectDir, "node_modules/vite"), { recursive: true });
    await writeFile(
      path.join(projectDir, "node_modules/vite/package.json"),
      JSON.stringify({
        name: "vite",
        version: installedVite,
        exports: { "./package.json": "./package.json" },
      }),
    );
  }
  return projectDir;
};

describe("assertCompatiblePeers", (): void => {
  it.each(["~6.3.0", "6.3.5"])(
    "rejects a declared Vite (%s) that the template's Vitest cannot use",
    async (vite: string): Promise<void> => {
      await expect(
        assertCompatiblePeers(
          await createProject(),
          { devDependencies: { vite } },
          template,
        ),
      ).rejects.toThrow(
        `strong-mode adds vitest ^5.0.2, which requires vite ^6.4.0 || ^7.0.0 || ^8.0.0, but package.json declares vite "${vite}"`,
      );
    },
  );

  it("also checks a Vite declared in dependencies", async (): Promise<void> => {
    await expect(
      assertCompatiblePeers(
        await createProject(),
        { dependencies: { vite: "~6.3.0" } },
        template,
      ),
    ).rejects.toThrow("declares vite");
  });

  it("rejects an installed Vite the template's Vitest cannot use, even when the declared range allows a newer one", async (): Promise<void> => {
    await expect(
      assertCompatiblePeers(
        await createProject("5.4.14"),
        { devDependencies: { vite: "^5.0.0 || ^6.0.0" } },
        template,
      ),
    ).rejects.toThrow(
      'but the installed vite is 5.4.14 (package.json declares "^5.0.0 || ^6.0.0")',
    );
  });

  it.each(["npm:vite@5.4.14", "catalog:"])(
    "rejects an installed Vite the template's Vitest cannot use when it is declared as %s",
    async (vite: string): Promise<void> => {
      await expect(
        assertCompatiblePeers(
          await createProject("5.4.14"),
          { devDependencies: { vite } },
          template,
        ),
      ).rejects.toThrow(
        `but the installed vite is 5.4.14 (package.json declares "${vite}")`,
      );
    },
  );

  it.each([
    [
      "a compatible installed Vite",
      "6.4.1",
      { devDependencies: { vite: "^5.0.0 || ^6.0.0" } },
    ],
    ["nothing installed", undefined, { devDependencies: { vite: "^5.0.0 || ^6.0.0" } }],
    [
      "its own Vitest, which strong-mode keeps",
      "5.4.14",
      { devDependencies: { vite: "^5.0.0 || ^6.0.0", vitest: "^3.2.0" } },
    ],
    [
      "a range that reaches a supported Vite",
      undefined,
      { devDependencies: { vite: "^6.2.0" } },
    ],
    ["a supported Vite", undefined, { devDependencies: { vite: "^7.0.0" } }],
    ["no Vite", undefined, { devDependencies: {} }],
    ["no package.json", undefined, undefined],
    [
      "a specifier that is not a semver range",
      undefined,
      { devDependencies: { vite: "catalog:" } },
    ],
    [
      "a compatible installed Vite behind an alias",
      "6.4.1",
      { devDependencies: { vite: "npm:vite@6.4.1" } },
    ],
  ])(
    "accepts a project with %s",
    async (
      _label: string,
      installedVite: string | undefined,
      target: PackageJsonLike | undefined,
    ): Promise<void> => {
      await expect(
        assertCompatiblePeers(await createProject(installedVite), target, template),
      ).resolves.toBeUndefined();
    },
  );
});
