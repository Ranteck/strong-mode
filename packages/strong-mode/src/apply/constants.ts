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
    sourceRelativePath: "tsconfig.eslint.json",
    targetRelativePath: "tsconfig.eslint.json",
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
    sourceRelativePath: "scripts/prepare-hooks.mjs",
    targetRelativePath: "scripts/prepare-hooks.mjs",
  },
  {
    sourceRelativePath: "gitignore",
    targetRelativePath: ".gitignore",
  },
  {
    sourceRelativePath: "src/env.ts",
    targetRelativePath: "src/env.ts",
  },
  {
    sourceRelativePath: "tests/env.test.ts",
    targetRelativePath: "tests/env.test.ts",
  },
];

// Packages released in lockstep with a leader package that they require at the
// exact same version as a peer. When the template adds the follower but the
// project already declares the leader, reuse the project's leader range.
export const LOCKSTEP_DEV_DEPENDENCIES: Readonly<Record<string, string>> = {
  "@vitest/coverage-v8": "vitest",
};
