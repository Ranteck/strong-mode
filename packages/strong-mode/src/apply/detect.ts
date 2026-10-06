import { readFile } from "node:fs/promises";
import path from "node:path";
import { MANAGED_TEMPLATE_FILES } from "./constants.js";
import { readTextIfExists } from "./io.js";
import type { ManagedFile, PackageJsonLike } from "./types.js";
import { renderTemplateContent, sanitizePackageName } from "../template.js";

export interface ApplyDetection {
  readonly targetPackageJson: PackageJsonLike | undefined;
  readonly templatePackageJson: PackageJsonLike;
  readonly managedFiles: readonly ManagedFile[];
  readonly projectName: string;
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
  };
};
