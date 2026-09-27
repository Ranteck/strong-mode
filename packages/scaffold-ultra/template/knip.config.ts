/** @type {import("knip").KnipConfig} */
const config = {
  // No entry/project overrides: knip's defaults plus its framework plugins (Next.js,
  // Vite, Astro, Vitest, ...) find the real entry points of any project layout.
  // Strict on purpose: an export used only inside its own file still counts as unused.
  ignoreExportsUsedInFile: false,
};

export default config;
