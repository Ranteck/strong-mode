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
    sourceRelativePath: "prettierignore",
    targetRelativePath: ".prettierignore",
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
// exact same version as a peer. When the project already declares the leader, the
// follower is added after install, pinned to the installed leader version.
export const LOCKSTEP_DEV_DEPENDENCIES: Readonly<Record<string, string>> = {
  "@vitest/coverage-v8": "vitest",
};

// A dependent managed file is only written when the file it depends on ends up
// with the template's content (created, overwritten or already identical);
// otherwise it would test code the project does not have.
export const MANAGED_FILE_DEPENDENCIES: Readonly<Record<string, string>> = {
  "tests/env.test.ts": "src/env.ts",
};

// Managed tests written for Vitest. They are only added when the project's "test"
// script runs Vitest; another runner (Jest, node --test) would pick them up and fail.
export const VITEST_TEST_FILES: ReadonlySet<string> = new Set(["tests/env.test.ts"]);

export const OTHER_TEST_RUNNERS: readonly string[] = [
  "jest",
  "@playwright/test",
  "playwright",
  "mocha",
  "ava",
  "jasmine",
];

// Peers that packages added by the template require from packages the project may
// already declare. Only checked when the template adds the package itself; keep the
// range in sync with that package's own peerDependencies when bumping the template.
export const TEMPLATE_PEER_REQUIREMENTS: Readonly<
  Record<string, { readonly peer: string; readonly range: string }>
> = {
  vitest: { peer: "vite", range: "^6.4.0 || ^7.0.0 || ^8.0.0" },
};

// Packages the template stopped shipping, with their replacement and the managed
// config file that loads them. The old package is removed only when that config
// file ends up with the template content; otherwise the project's own config may
// still import it.
export const REPLACED_DEV_DEPENDENCIES: Readonly<
  Record<string, { readonly replacement: string; readonly configFile: string }>
> = {
  "eslint-plugin-eslint-comments": {
    replacement: "@eslint-community/eslint-plugin-eslint-comments",
    configFile: "eslint.config.mjs",
  },
};
