export interface ManagedTemplateFile {
  readonly sourceRelativePath: string;
  readonly targetRelativePath: string;
}

export const MANAGED_TEMPLATE_FILES: readonly ManagedTemplateFile[] = [
  {
    sourceRelativePath: "tsconfig.json",
    targetRelativePath: "tsconfig.json",
  },
  {
    sourceRelativePath: "eslint.config.mjs",
    targetRelativePath: "eslint.config.mjs",
  },
  {
    sourceRelativePath: "prettier.config.mjs",
    targetRelativePath: "prettier.config.mjs",
  },
  {
    sourceRelativePath: "vitest.config.ts",
    targetRelativePath: "vitest.config.ts",
  },
  {
    sourceRelativePath: "knip.config.ts",
    targetRelativePath: "knip.config.ts",
  },
  {
    sourceRelativePath: "depcruise.config.cjs",
    targetRelativePath: "depcruise.config.cjs",
  },
  {
    sourceRelativePath: "lefthook.yml",
    targetRelativePath: "lefthook.yml",
  },
  {
    sourceRelativePath: "scripts/run-package-manager.sh",
    targetRelativePath: "scripts/run-package-manager.sh",
  },
  {
    sourceRelativePath: "gitignore",
    targetRelativePath: ".gitignore",
  },
  {
    sourceRelativePath: "src/env.ts",
    targetRelativePath: "src/env.ts",
  },
];
