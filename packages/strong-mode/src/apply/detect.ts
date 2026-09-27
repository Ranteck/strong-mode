import { readFile } from "node:fs/promises";
import path from "node:path";
import { log } from "@clack/prompts";
import { valid } from "semver";
import { LOCKSTEP_DEV_DEPENDENCIES, MANAGED_TEMPLATE_FILES } from "./constants.js";
import { fileExists, readTextIfExists } from "./io.js";
import type { ManagedFile, PackageJsonLike } from "./types.js";
import { renderTemplateContent, sanitizePackageName } from "../template.js";

export interface ApplyDetection {
  readonly targetPackageJson: PackageJsonLike | undefined;
  readonly templatePackageJson: PackageJsonLike;
  readonly managedFiles: readonly ManagedFile[];
  readonly projectName: string;
  // Versions of lockstep leaders found in node_modules, keyed by package name.
  readonly installedVersions: Readonly<Record<string, string>>;
}

const readJson = async <T extends object>(filePath: string): Promise<T> => {
  let source: string;
  try {
    source = await readFile(filePath, "utf8");
  } catch (error: unknown) {
    throw new Error(`Failed to read ${filePath}.`, { cause: error });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch (error: unknown) {
    throw new Error(`Invalid JSON in ${filePath}.`, { cause: error });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `Expected a JSON object in ${filePath}, got ${Array.isArray(parsed) ? "array" : String(parsed)}.`,
    );
  }
  return parsed as T;
};

export const readJsonIfExists = async <T extends object>(
  filePath: string,
): Promise<T | undefined> => {
  const source = await readTextIfExists(filePath);
  if (source === undefined) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch (error: unknown) {
    throw new Error(`Invalid JSON in ${filePath}.`, { cause: error });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `Expected a JSON object in ${filePath}, got ${Array.isArray(parsed) ? "array" : String(parsed)}.`,
    );
  }
  return parsed as T;
};

const PROJECT_ROOT_MARKERS: readonly string[] = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  ".git",
];

// The project directory and its parents up to the first one that owns a lockfile
// or .git (the workspace root), so hoisted installs are found without reading
// node_modules that belong to an unrelated parent directory.
const findSearchRoots = async (targetDir: string): Promise<readonly string[]> => {
  const start = path.resolve(targetDir);
  const roots: string[] = [];
  let dir = start;
  for (;;) {
    roots.push(dir);
    const markers = await Promise.all(
      PROJECT_ROOT_MARKERS.map(
        async (marker): Promise<boolean> => fileExists(path.join(dir, marker)),
      ),
    );
    if (markers.includes(true)) {
      return roots;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return [start];
    }
    dir = parent;
  }
};

const readInstalledVersion = async (
  leader: string,
  searchRoots: readonly string[],
): Promise<string | undefined> => {
  for (const root of searchRoots) {
    const manifestPath = path.join(root, "node_modules", leader, "package.json");
    let manifest: { version?: unknown } | undefined;
    try {
      manifest = await readJsonIfExists<{ version?: unknown }>(manifestPath);
    } catch (error: unknown) {
      // The installed version is only a hint for pinning lockstep packages; a broken
      // node_modules must not stop apply.
      log.warn(
        `Could not read the installed ${leader} (${error instanceof Error ? error.message : String(error)}); its lockstep packages will follow the declared range. Reinstall dependencies to fix.`,
      );
      return undefined;
    }

    if (manifest !== undefined) {
      const version =
        typeof manifest.version === "string" ? valid(manifest.version) : null;
      return version ?? undefined;
    }
  }

  return undefined;
};

export const readInstalledVersions = async (
  targetDir: string,
): Promise<Record<string, string>> => {
  const searchRoots = await findSearchRoots(targetDir);
  const leaders = [...new Set(Object.values(LOCKSTEP_DEV_DEPENDENCIES))];
  const entries = await Promise.all(
    leaders.map(async (leader): Promise<readonly [string, string] | undefined> => {
      const version = await readInstalledVersion(leader, searchRoots);
      return version === undefined ? undefined : [leader, version];
    }),
  );

  return Object.fromEntries(entries.filter((entry) => entry !== undefined));
};

export const detectApplyInput = async (
  targetDir: string,
  templateDir: string,
): Promise<ApplyDetection> => {
  const packageJsonPath = path.join(targetDir, "package.json");
  const targetPackageJson = await readJsonIfExists<PackageJsonLike>(packageJsonPath);

  const fallbackProjectName = sanitizePackageName(path.basename(targetDir));
  const projectName =
    typeof targetPackageJson?.name === "string" && targetPackageJson.name.length > 0
      ? targetPackageJson.name
      : fallbackProjectName;

  const templatePackageJsonPath = path.join(templateDir, "package.json");
  const templatePackageJsonRaw = await readJson<PackageJsonLike>(
    templatePackageJsonPath,
  );
  const renderedTemplatePackageJson = renderTemplateContent(
    JSON.stringify(templatePackageJsonRaw),
    projectName,
  );
  const templatePackageJson: PackageJsonLike = ((): PackageJsonLike => {
    try {
      return JSON.parse(renderedTemplatePackageJson) as PackageJsonLike;
    } catch (error: unknown) {
      throw new Error(
        `Invalid rendered JSON from template package file: ${templatePackageJsonPath}.`,
        {
          cause: error,
        },
      );
    }
  })();

  const managedFiles = await Promise.all(
    MANAGED_TEMPLATE_FILES.map(async (managedTemplateFile): Promise<ManagedFile> => {
      const sourceTemplatePath = path.join(
        templateDir,
        managedTemplateFile.sourceRelativePath,
      );
      let sourceContent: string;
      try {
        sourceContent = await readFile(sourceTemplatePath, "utf8");
      } catch (error: unknown) {
        throw new Error(
          `Failed to read template file ${managedTemplateFile.sourceRelativePath}. Run \`npm run sync:template\` or reinstall strong-mode.`,
          { cause: error },
        );
      }
      const renderedContent = renderTemplateContent(sourceContent, projectName);
      const targetPath = path.join(targetDir, managedTemplateFile.targetRelativePath);
      const existingContent = await readTextIfExists(targetPath);

      return {
        relativePath: managedTemplateFile.targetRelativePath,
        sourceTemplatePath: managedTemplateFile.sourceRelativePath,
        content: renderedContent,
        exists: existingContent !== undefined,
      };
    }),
  );

  return {
    targetPackageJson,
    templatePackageJson,
    managedFiles,
    projectName,
    installedVersions: await readInstalledVersions(targetDir),
  };
};
