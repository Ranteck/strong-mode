import type { PackageJsonLike } from "./types.js";

// The template is ESM-only (NodeNext + verbatimModuleSyntax), so applying it to a
// CommonJS project breaks typecheck. CommonJS support is tracked in the README
// "Roadmap / Known limitations" section.
export const assertEsmProject = (packageJson: PackageJsonLike | undefined): void => {
  if (packageJson?.type === "commonjs") {
    throw new Error(
      'strong-mode requires an ES module project, but package.json has "type": "commonjs". ' +
        "Switch it to ESM first (for example `npm pkg set type=module`, then replace " +
        "require()/module.exports) and re-run.",
    );
  }
};
