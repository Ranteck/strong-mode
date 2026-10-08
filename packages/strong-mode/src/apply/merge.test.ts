import * as jsonc from "jsonc-parser";
import { describe, expect, it, vi } from "vitest";
import { isMergeableManagedFile, mergeManagedFileContent } from "./merge.js";

describe("mergeManagedFileContent", (): void => {
  it("appends missing include entries while keeping array comments and a trailing comma", (): void => {
    const existing = [
      "{",
      '  "include": [',
      '    "src", // project sources',
      '    "test",',
      "  ],",
      "}",
      "",
    ].join("\r\n");
    const result = mergeManagedFileContent(
      "tsconfig.json",
      existing,
      '{"include":["src", "src/**/*", "tests/**/*"]}',
    );
    const content = result?.content ?? "";

    expect(content).toContain('"src", // project sources');
    expect(content).toContain('"tests/**/*",\r\n  ]');
    expect(content.replaceAll("\r\n", "")).not.toContain("\n");
    expect(jsonc.parse(content)).toEqual({
      include: ["src", "test", "src/**/*", "tests/**/*"],
    });
    expect(result?.raisedOptions).toEqual([]);
  });

  it("keeps duplicate project array elements and appends each missing template element once", (): void => {
    const result = mergeManagedFileContent(
      "tsconfig.json",
      '{"include":["src", "src"]}',
      '{"include":["src", "tests", "tests"]}',
    );

    expect(jsonc.parse(result?.content ?? "{}")).toEqual({
      include: ["src", "src", "tests"],
    });
  });

  it("keeps an unchanged array with duplicate elements byte-for-byte", (): void => {
    const existing = '{"include":["src", /* intentional repeat */ "src",]}';

    expect(
      mergeManagedFileContent("tsconfig.json", existing, '{"include":["src"]}'),
    ).toEqual({ content: existing, raisedOptions: [] });
  });

  it("replaces the template-owned exclude array including comments inside it", (): void => {
    const result = mergeManagedFileContent(
      "tsconfig.eslint.json",
      '{"exclude":["tests", /* old exclusion */ "tests",]}',
      '{"exclude":["node_modules"]}',
    );

    expect(jsonc.parse(result?.content ?? "{}")).toEqual({
      exclude: ["node_modules"],
    });
    expect(result?.content).not.toContain("/* old exclusion */");
  });

  it("merges a BOM file, preserves its BOM and reports the raise", (): void => {
    const existing = '\uFEFF{\r\n  "compilerOptions": { "strict": false, },\r\n}\r\n';
    const result = mergeManagedFileContent(
      "tsconfig.json",
      existing,
      '{"compilerOptions":{"strict":true}}',
    );

    expect(result?.content).toBe(existing.replace("false", "true"));
    expect(result?.raisedOptions).toEqual([{ name: "strict", from: false, to: true }]);
  });

  it.each([
    '{"compilerOptions":{"strict":false,"strict":false}}',
    '{"compilerOptions":{"strict":true},"compilerOptions":{"strict":false}}',
    '{"compilerOptions":null,"compilerOptions":{"strict":false}}',
    '{"compilerOptions":[],"compilerOptions":{"strict":false}}',
    '{"custom":{"nested":{"value":1,"value":2}}}',
    '{"custom":[{"value":1,"value":2}]}',
    '{"compilerOptions":{"str\\u0069ct":false,"strict":false}}',
    '{"__proto__":{"compilerOptions":{"strict":false}}}',
    '{"compilerOptions":{"__proto__":{"strict":false}}}',
    '{"custom":[{"__proto__":null}]}',
  ])(
    "returns undefined without throwing for unsafe object keys on either side: %s",
    (invalid): void => {
      const valid = '{"compilerOptions":{"strict":true}}';

      for (const relativePath of ["tsconfig.json", "tsconfig.eslint.json"]) {
        expect(mergeManagedFileContent(relativePath, invalid, valid)).toBeUndefined();
        expect(mergeManagedFileContent(relativePath, valid, invalid)).toBeUndefined();
      }
    },
  );

  it("returns undefined when the written content does not match the computed merge", (): void => {
    const modify = vi.spyOn(jsonc, "modify").mockReturnValue([]);
    try {
      expect(
        mergeManagedFileContent(
          "tsconfig.json",
          '{"compilerOptions":{"strict":false}}',
          '{"compilerOptions":{"strict":true}}',
        ),
      ).toBeUndefined();
    } finally {
      modify.mockRestore();
    }
  });

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
    const merged = JSON.parse(result?.content ?? "{}") as {
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
    const merged = JSON.parse(result?.content ?? "{}") as { exclude?: string[] };

    expect(merged.exclude).toEqual(["node_modules", "dist", "coverage"]);
  });

  it("still merges exclude additively in tsconfig.json", (): void => {
    const result = mergeManagedFileContent(
      "tsconfig.json",
      JSON.stringify({ exclude: ["tests"] }),
      JSON.stringify({ exclude: ["node_modules"] }),
    );
    const merged = JSON.parse(result?.content ?? "{}") as { exclude?: string[] };

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

    const merged = JSON.parse(result?.content ?? "{}") as {
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

    expect(result).toEqual({
      content: "node_modules/\ndist/\n.env\ncoverage/\n.DS_Store\n",
      raisedOptions: [],
    });
  });

  it("merges .prettierignore entries without duplicates", (): void => {
    const result = mergeManagedFileContent(
      ".prettierignore",
      "build/\npnpm-lock.yaml\n",
      "pnpm-lock.yaml\npackage-lock.json\n",
    );

    expect(result).toEqual({
      content: "build/\npnpm-lock.yaml\npackage-lock.json\n",
      raisedOptions: [],
    });
  });

  it("raises explicit type-checking options in category order, including false template values", (): void => {
    const result = mergeManagedFileContent(
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: {
          allowUnreachableCode: true,
          noUnusedLocals: false,
          strict: false,
          strictBuiltinIteratorReturn: false,
          exactOptionalPropertyTypes: true,
          allowUnusedLabels: true,
          target: "ES2020",
        },
      }),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          strictBuiltinIteratorReturn: true,
          noUnusedLocals: true,
          exactOptionalPropertyTypes: true,
          noUncheckedIndexedAccess: true,
          allowUnusedLabels: false,
          allowUnreachableCode: false,
          target: "ES2024",
        },
      }),
    );
    const merged = JSON.parse(result?.content ?? "{}") as {
      compilerOptions?: Record<string, unknown>;
    };

    expect(merged.compilerOptions).toEqual({
      allowUnreachableCode: false,
      noUnusedLocals: true,
      strict: true,
      strictBuiltinIteratorReturn: true,
      exactOptionalPropertyTypes: true,
      allowUnusedLabels: false,
      target: "ES2020",
      noUncheckedIndexedAccess: true,
    });
    expect(result?.raisedOptions).toEqual([
      { name: "strict", from: false, to: true },
      { name: "strictBuiltinIteratorReturn", from: false, to: true },
      { name: "noUnusedLocals", from: false, to: true },
      { name: "allowUnusedLabels", from: true, to: false },
      { name: "allowUnreachableCode", from: true, to: false },
    ]);
  });

  it("keeps extends and options outside the type-checking category", (): void => {
    const result = mergeManagedFileContent(
      "tsconfig.json",
      JSON.stringify({
        extends: "@tsconfig/node22/tsconfig.json",
        compilerOptions: {
          skipLibCheck: true,
          verbatimModuleSyntax: false,
          isolatedModules: false,
          module: "commonjs",
          noUnusedParameters: false,
        },
      }),
      JSON.stringify({
        extends: "./base.json",
        compilerOptions: {
          skipLibCheck: false,
          verbatimModuleSyntax: true,
          isolatedModules: true,
          module: "NodeNext",
          strict: true,
        },
      }),
    );
    const merged = JSON.parse(result?.content ?? "{}") as {
      extends?: string;
      compilerOptions?: Record<string, unknown>;
    };

    expect(merged.extends).toBe("@tsconfig/node22/tsconfig.json");
    expect(merged.compilerOptions).toEqual({
      skipLibCheck: true,
      verbatimModuleSyntax: false,
      isolatedModules: false,
      module: "commonjs",
      noUnusedParameters: false,
      strict: true,
    });
    expect(result?.raisedOptions).toEqual([]);
  });

  it("does not force type-checking options in tsconfig.eslint.json", (): void => {
    const result = mergeManagedFileContent(
      "tsconfig.eslint.json",
      '{ "compilerOptions": { "strict": false }, "exclude": ["tests"] }',
      '{ "compilerOptions": { "strict": true }, "exclude": ["node_modules"] }',
    );

    expect(JSON.parse(result?.content ?? "{}")).toEqual({
      compilerOptions: { strict: false },
      exclude: ["node_modules"],
    });
    expect(result?.raisedOptions).toEqual([]);
  });

  it("edits a commented tsconfig in place, keeping comments, trailing commas and CRLF", (): void => {
    const existing = [
      "{",
      "  // Visit https://aka.ms/tsconfig to read more about this file",
      '  "compilerOptions": {',
      '    "strict": false, // turned off while migrating',
      '    "target": "es2016",',
      "  },",
      "}",
      "",
    ].join("\r\n");
    const result = mergeManagedFileContent(
      "tsconfig.json",
      existing,
      JSON.stringify({ compilerOptions: { strict: true, noImplicitOverride: true } }),
    );
    const content = result?.content ?? "";

    expect(content).toContain(
      "// Visit https://aka.ms/tsconfig to read more about this file",
    );
    expect(content).toContain('"strict": true, // turned off while migrating');
    expect(content).toContain('"target": "es2016",');
    expect(content).toContain('    "noImplicitOverride": true');
    expect(content).toContain("  },\r\n}");
    expect(content.indexOf('"strict"')).toBeLessThan(content.indexOf('"target"'));
    expect(content.indexOf('"target"')).toBeLessThan(
      content.indexOf('"noImplicitOverride"'),
    );
    expect(content.replaceAll("\r\n", "")).not.toContain("\n");
    expect(result?.raisedOptions).toEqual([{ name: "strict", from: false, to: true }]);
  });

  it("keeps a JSONC file byte-for-byte when the target does not differ", (): void => {
    const existing =
      '{\n\t/* user formatting */ "compilerOptions": { "strict": true, },\n}\n';
    expect(
      mergeManagedFileContent(
        "tsconfig.json",
        existing,
        '{"compilerOptions":{"strict":true}}',
      ),
    ).toEqual({ content: existing, raisedOptions: [] });
  });

  it("keeps user spacing when only an existing scalar changes", (): void => {
    const existing =
      '{\r\n\t"compilerOptions" : { "strict" : false, /* keep */ "target" : "ES2020", },\r\n}\r\n';
    const result = mergeManagedFileContent(
      "tsconfig.json",
      existing,
      '{"compilerOptions":{"strict":true}}',
    );

    expect(result?.content).toBe(existing.replace("false", "true"));
  });

  it.each([
    "{ invalid json",
    '{"compilerOptions": {"strict": false} "include": []}',
    "[]",
    "null",
    '"config"',
    '{"compilerOptions": "strict"}',
    '{"compilerOptions": null}',
    '{"compilerOptions": []}',
    '{"compilerOptions": false}',
    '{"compilerOptions": 1}',
  ])(
    "returns undefined for invalid tsconfig input on either side: %s",
    (invalid): void => {
      const valid = '{"compilerOptions":{"strict":true}}';

      expect(mergeManagedFileContent("tsconfig.json", invalid, valid)).toBeUndefined();
      expect(mergeManagedFileContent("tsconfig.json", valid, invalid)).toBeUndefined();
    },
  );
});

describe("isMergeableManagedFile", (): void => {
  it("identifies the mergeable managed files", (): void => {
    expect(isMergeableManagedFile("tsconfig.json")).toBe(true);
    expect(isMergeableManagedFile(".gitignore")).toBe(true);
    expect(isMergeableManagedFile(".prettierignore")).toBe(true);
    expect(isMergeableManagedFile("eslint.config.mjs")).toBe(false);
  });
});
