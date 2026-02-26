import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, "../packages/scaffold-ultra/template");
const targetDir = path.resolve(__dirname, "../packages/create-zero-ts/template");

const toPosixPath = (filePath) => filePath.split(path.sep).join("/");

const collectFiles = async (directoryPath, basePath = directoryPath) => {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(absolutePath, basePath);
      }

      return [toPosixPath(path.relative(basePath, absolutePath))];
    }),
  );

  return nested.flat().sort((left, right) => left.localeCompare(right));
};

const verifyDirectoryExists = async (directoryPath) => {
  const exists = await stat(directoryPath).then(() => true).catch(() => false);
  if (!exists) {
    throw new Error(`Missing directory: ${directoryPath}`);
  }
};

const compareTemplateDirectories = async () => {
  await Promise.all([verifyDirectoryExists(sourceDir), verifyDirectoryExists(targetDir)]);

  const [sourceFiles, targetFiles] = await Promise.all([
    collectFiles(sourceDir),
    collectFiles(targetDir),
  ]);

  const sourceSet = new Set(sourceFiles);
  const targetSet = new Set(targetFiles);

  const missingInTarget = sourceFiles.filter((relativePath) => !targetSet.has(relativePath));
  const extraInTarget = targetFiles.filter((relativePath) => !sourceSet.has(relativePath));

  const sharedFiles = sourceFiles.filter((relativePath) => targetSet.has(relativePath));
  const contentDiffs = [];

  for (const relativePath of sharedFiles) {
    const [sourceContent, targetContent] = await Promise.all([
      readFile(path.join(sourceDir, relativePath)),
      readFile(path.join(targetDir, relativePath)),
    ]);

    if (!sourceContent.equals(targetContent)) {
      contentDiffs.push(relativePath);
    }
  }

  return {
    missingInTarget,
    extraInTarget,
    contentDiffs,
  };
};

const result = await compareTemplateDirectories();
const hasDifferences =
  result.missingInTarget.length > 0 ||
  result.extraInTarget.length > 0 ||
  result.contentDiffs.length > 0;

if (!hasDifferences) {
  process.stdout.write("Template sync check passed.\n");
  process.exit(0);
}

process.stderr.write("Template sync check failed.\n");

if (result.missingInTarget.length > 0) {
  process.stderr.write(`Missing files in create-zero-ts/template (${String(result.missingInTarget.length)}):\n`);
  for (const relativePath of result.missingInTarget) {
    process.stderr.write(`  - ${relativePath}\n`);
  }
}

if (result.extraInTarget.length > 0) {
  process.stderr.write(`Extra files in create-zero-ts/template (${String(result.extraInTarget.length)}):\n`);
  for (const relativePath of result.extraInTarget) {
    process.stderr.write(`  - ${relativePath}\n`);
  }
}

if (result.contentDiffs.length > 0) {
  process.stderr.write(`Files with content differences (${String(result.contentDiffs.length)}):\n`);
  for (const relativePath of result.contentDiffs) {
    process.stderr.write(`  - ${relativePath}\n`);
  }
}

process.stderr.write("\nRun `npm run sync:template` and commit the resulting changes.\n");
process.exit(1);
