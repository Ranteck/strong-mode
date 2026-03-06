import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isErrnoException } from "./errors.js";

export const TEMPLATE_TOKEN_PROJECT_NAME = "__PROJECT_NAME__";

export const sanitizePackageName = (input: string): string =>
  input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "-");

const pathExistsSync = (targetPath: string): boolean => {
  try {
    statSync(targetPath);
    return true;
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
};

export const resolveTemplateDir = (): string => {
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFilePath);
  const templateDir = path.resolve(currentDir, "../template");
  if (!pathExistsSync(templateDir)) {
    throw new Error(
      `Template directory not found: ${templateDir}. Run \`npm run sync:template\` in this repository or reinstall slop-free.`,
    );
  }

  return templateDir;
};

export const renderTemplateContent = (source: string, projectName: string): string =>
  source.replaceAll(TEMPLATE_TOKEN_PROJECT_NAME, projectName);
