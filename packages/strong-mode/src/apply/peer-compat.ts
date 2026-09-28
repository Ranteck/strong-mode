import semver from "semver";
import { TEMPLATE_PEER_REQUIREMENTS } from "./constants.js";
import type { PackageJsonLike } from "./types.js";

const declaredVersion = (
  packageJson: PackageJsonLike | undefined,
  name: string,
): string | undefined =>
  packageJson?.devDependencies?.[name] ?? packageJson?.dependencies?.[name];

// A package the template adds can require a peer the project already pins to an
// incompatible version (Vitest 5 needs Vite 6.4+). Installing would then fail after
// every file is written, so the combination is rejected up front. Specifiers that
// are not semver ranges (catalog:, workspace:, npm: aliases, tags) are not checked.
export const assertCompatiblePeers = (
  target: PackageJsonLike | undefined,
  template: PackageJsonLike,
): void => {
  for (const [name, { peer, range }] of Object.entries(TEMPLATE_PEER_REQUIREMENTS)) {
    const added = declaredVersion(template, name);
    const projectPeer = declaredVersion(target, peer);
    if (
      added === undefined ||
      declaredVersion(target, name) !== undefined ||
      projectPeer === undefined ||
      semver.validRange(projectPeer) === null ||
      semver.intersects(projectPeer, range)
    ) {
      continue;
    }

    throw new Error(
      `strong-mode adds ${name} ${added}, which requires ${peer} ${range}, but package.json declares ${peer} "${projectPeer}". ` +
        `Upgrade ${peer} (for example \`npm install -D ${peer}@^${semver.minVersion(range)?.version ?? range}\`) and re-run.`,
    );
  }
};
