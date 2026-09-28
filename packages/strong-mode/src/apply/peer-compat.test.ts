import { describe, expect, it } from "vitest";
import { assertCompatiblePeers } from "./peer-compat.js";
import type { PackageJsonLike } from "./types.js";

const template: PackageJsonLike = {
  devDependencies: { vite: "^8.3.1", vitest: "^5.0.2" },
};

describe("assertCompatiblePeers", (): void => {
  it.each(["~6.3.0", "6.3.5"])(
    "rejects a project Vite (%s) that the template's Vitest cannot use",
    (vite: string): void => {
      expect(() => {
        assertCompatiblePeers({ devDependencies: { vite } }, template);
      }).toThrow(
        `strong-mode adds vitest ^5.0.2, which requires vite ^6.4.0 || ^7.0.0 || ^8.0.0, but package.json declares vite "${vite}"`,
      );
    },
  );

  it("also checks a Vite declared in dependencies", (): void => {
    expect(() => {
      assertCompatiblePeers({ dependencies: { vite: "~6.3.0" } }, template);
    }).toThrow("declares vite");
  });

  it.each([
    ["a range that reaches a supported Vite", { devDependencies: { vite: "^6.2.0" } }],
    ["a supported Vite", { devDependencies: { vite: "^7.0.0" } }],
    ["no Vite", { devDependencies: {} }],
    ["no package.json", undefined],
    [
      "its own Vitest, which strong-mode keeps",
      { devDependencies: { vite: "~6.3.0", vitest: "^4.1.0" } },
    ],
    [
      "a specifier that is not a semver range",
      { devDependencies: { vite: "catalog:" } },
    ],
  ])(
    "accepts a project with %s",
    (_label: string, target: PackageJsonLike | undefined): void => {
      expect(() => {
        assertCompatiblePeers(target, template);
      }).not.toThrow();
    },
  );
});
