import { createRequire } from "node:module";
import path from "node:path";
import { readTextIfExists } from "./io.js";

// The version installed for this package, resolved the way Node resolves it from
// the project (hoisted installs, pnpm symlinks, aliases).
export const readInstalledVersion = async (
  targetDir: string,
  packageName: string,
): Promise<string | undefined> => {
  let manifestPath: string;
  try {
    manifestPath = createRequire(path.join(targetDir, "package.json")).resolve(
      `${packageName}/package.json`,
    );
  } catch {
    return undefined;
  }

  const source = await readTextIfExists(manifestPath);
  if (source === undefined) {
    return undefined;
  }

  try {
    const manifest = JSON.parse(source) as { version?: unknown };
    return typeof manifest.version === "string" && manifest.version.length > 0
      ? manifest.version
      : undefined;
  } catch {
    return undefined;
  }
};
