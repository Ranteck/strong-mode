import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isErrnoException } from "../errors.js";

const exists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
};

export const fileExists = exists;

export const ensureParentDirectory = async (filePath: string): Promise<void> => {
  try {
    await mkdir(path.dirname(filePath), { recursive: true });
  } catch (error: unknown) {
    throw new Error(`Failed to create parent directory for ${filePath}.`, { cause: error });
  }
};

export const readTextIfExists = async (filePath: string): Promise<string | undefined> => {
  try {
    return await readFile(filePath, "utf8");
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
};

export const writeTextFile = async (filePath: string, content: string): Promise<void> => {
  await ensureParentDirectory(filePath);
  try {
    await writeFile(filePath, content, "utf8");
  } catch (error: unknown) {
    throw new Error(`Failed to write ${filePath}.`, { cause: error });
  }
};

export const backupFile = async (sourcePath: string): Promise<string> => {
  const dateToken = new Date().toISOString().replaceAll(":", "-");
  const backupPath = `${sourcePath}.slop-free-backup.${dateToken}`;
  try {
    await copyFile(sourcePath, backupPath);
  } catch (error: unknown) {
    throw new Error(
      `Backup of ${sourcePath} failed — overwrite aborted to protect the original. Check disk space and permissions.`,
      { cause: error },
    );
  }

  return backupPath;
};
