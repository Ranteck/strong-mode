import { describe, expect, it } from "vitest";
import { isMergeableManagedFile, mergeManagedFileContent } from "./merge.js";

describe("mergeManagedFileContent", (): void => {
  it("merges tsconfig.eslint.json like tsconfig.json", (): void => {
    expect(isMergeableManagedFile("tsconfig.eslint.json")).toBe(true);

    const result = mergeManagedFileContent(
      "tsconfig.eslint.json",
      JSON.stringify({
        extends: "./tsconfig.base.json",
        include: ["src", "test"],
      }),
      JSON.stringify({
        extends: "./tsconfig.json",
        compilerOptions: { noEmit: true },
        include: ["src/**/*", "tests/**/*"],
      }),
    );
    const merged = JSON.parse(result ?? "{}") as {
      extends?: string;
      include?: string[];
      compilerOptions?: Record<string, unknown>;
    };

    expect(merged.extends).toBe("./tsconfig.base.json");
    expect(merged.compilerOptions?.noEmit).toBe(true);
    expect(merged.include).toEqual(["src", "test", "src/**/*", "tests/**/*"]);
  });

  it("keeps every linted file in the tsconfig.eslint.json program by taking the template's exclude", (): void => {
    const result = mergeManagedFileContent(
      "tsconfig.eslint.json",
      JSON.stringify({ include: ["src"], exclude: ["tests", "node_modules"] }),
      JSON.stringify({
        include: ["**/*.ts"],
        exclude: ["node_modules", "dist", "coverage"],
      }),
    );
    const merged = JSON.parse(result ?? "{}") as { exclude?: string[] };

    expect(merged.exclude).toEqual(["node_modules", "dist", "coverage"]);
  });

  it("still merges exclude additively in tsconfig.json", (): void => {
    const result = mergeManagedFileContent(
      "tsconfig.json",
      JSON.stringify({ exclude: ["tests"] }),
      JSON.stringify({ exclude: ["node_modules"] }),
    );
    const merged = JSON.parse(result ?? "{}") as { exclude?: string[] };

    expect(merged.exclude).toEqual(["tests", "node_modules"]);
  });

  it("merges tsconfig.json additively while preserving existing values", (): void => {
    const result = mergeManagedFileContent(
      "tsconfig.json",
      JSON.stringify({
        extends: "@repo/tsconfig/base.json",
        compilerOptions: {
          target: "ES2022",
          strict: true,
          lib: ["ES2022"],
        },
        include: ["src"],
      }),
      JSON.stringify({
        compilerOptions: {
          target: "ES2024",
          noUncheckedIndexedAccess: true,
          lib: ["ES2024"],
        },
        include: ["src/**/*"],
        exclude: ["dist"],
      }),
    );

    expect(result).toBeDefined();

    const merged = JSON.parse(result ?? "{}") as {
      extends?: string;
      include?: string[];
      exclude?: string[];
      compilerOptions?: Record<string, unknown>;
    };

    expect(merged.extends).toBe("@repo/tsconfig/base.json");
    expect(merged.compilerOptions?.target).toBe("ES2022");
    expect(merged.compilerOptions?.noUncheckedIndexedAccess).toBe(true);
    expect(merged.compilerOptions?.lib).toEqual(["ES2022", "ES2024"]);
    expect(merged.include).toEqual(["src", "src/**/*"]);
    expect(merged.exclude).toEqual(["dist"]);
  });

  it("returns undefined when tsconfig.json is invalid", (): void => {
    const result = mergeManagedFileContent(
      "tsconfig.json",
      "{ invalid json",
      '{"compilerOptions":{"strict":true}}',
    );

    expect(result).toBeUndefined();
  });

  it("merges gitignore entries without duplicates", (): void => {
    const result = mergeManagedFileContent(
      ".gitignore",
      "node_modules/\ndist/\n.env\n",
      "dist/\ncoverage/\n.env\n.DS_Store\n",
    );

    expect(result).toBe("node_modules/\ndist/\n.env\ncoverage/\n.DS_Store\n");
  });
});

describe("isMergeableManagedFile", (): void => {
  it("identifies the mergeable managed files", (): void => {
    expect(isMergeableManagedFile("tsconfig.json")).toBe(true);
    expect(isMergeableManagedFile(".gitignore")).toBe(true);
    expect(isMergeableManagedFile("eslint.config.mjs")).toBe(false);
  });
});
