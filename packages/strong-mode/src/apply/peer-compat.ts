import semver from "semver";
import { TEMPLATE_PEER_REQUIREMENTS } from "./constants.js";
import { readInstalledVersion } from "./installed.js";
import type { PackageJsonLike } from "./types.js";

const declaredVersion = (
  packageJson: PackageJsonLike | undefined,
  name: string,
): string | undefined =>
  packageJson?.devDependencies?.[name] ?? packageJson?.dependencies?.[name];

const upgradeHint = (peer: string, range: string): string =>
  `Upgrade ${peer} (for example \`npm install -D ${peer}@^${semver.minVersion(range)?.version ?? range}\`) and re-run.`;

// Why the project's peer cannot work with the version the template requires, if it
// cannot: its declared range is disjoint from it, or the installed version (which a
// package manager such as Yarn Classic keeps from the lockfile) falls outside it.
// Specifiers that are not semver ranges (catalog:, workspace:, npm: aliases, tags)
// cannot be compared, but the version they installed still can.
const incompatibility = async (
  targetDir: string,
  peer: string,
  declared: string,
  range: string,
): Promise<string | undefined> => {
  if (semver.validRange(declared) !== null && !semver.intersects(declared, range)) {
    return `package.json declares ${peer} "${declared}"`;
  }
  const installed = await readInstalledVersion(targetDir, peer);
  return installed !== undefined && !semver.satisfies(installed, range)
    ? `the installed ${peer} is ${installed} (package.json declares "${declared}")`
    : undefined;
};

// A package the template adds can require a peer the project already pins to an
// incompatible version (Vitest 5 needs Vite 6.4+). Installing would then fail after
// every file is written, so the combination is rejected up front. Without
// node_modules (lockfile-only checkouts, Yarn PnP) only a semver declared range is.
export const assertCompatiblePeers = async (
  targetDir: string,
  target: PackageJsonLike | undefined,
  template: PackageJsonLike,
): Promise<void> => {
  for (const [name, { peer, range }] of Object.entries(TEMPLATE_PEER_REQUIREMENTS)) {
    const added = declaredVersion(template, name);
    const declared = declaredVersion(target, peer);
    if (
      added === undefined ||
      declaredVersion(target, name) !== undefined ||
      declared === undefined
    ) {
      continue;
    }

    const reason = await incompatibility(targetDir, peer, declared, range);
    if (reason !== undefined) {
      throw new Error(
        `strong-mode adds ${name} ${added}, which requires ${peer} ${range}, but ${reason}. ${upgradeHint(peer, range)}`,
      );
    }
  }
};
