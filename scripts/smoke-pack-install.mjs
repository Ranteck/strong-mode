import { copyFile, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageDir = path.resolve(__dirname, "../packages/create-zero-ts");

const run = (command, args, cwd) => {
  const quoteArg = (value) =>
    /[\s"]/u.test(value) ? `"${value.replaceAll("\"", "\\\"")}"` : value;
  const fullCommand = [command, ...args].map((value) => quoteArg(value)).join(" ");

  const result = spawnSync(fullCommand, {
    cwd,
    encoding: "utf8",
    shell: true,
  });

  if (result.status !== 0) {
    const errorMessage = result.error instanceof Error ? result.error.message : "";
    throw new Error(
      [
        `Command failed: ${fullCommand}`,
        result.stdout?.trim() ?? "",
        result.stderr?.trim() ?? "",
        errorMessage,
      ]
        .filter((line) => line.length > 0)
        .join("\n"),
    );
  }

  return result.stdout;
};

const parsePackJson = (rawOutput) => {
  const trimmed = rawOutput.trim();
  const jsonStart = trimmed.indexOf("[");
  if (jsonStart === -1) {
    throw new Error(`Unable to parse npm pack --json output: ${trimmed}`);
  }

  const normalized = trimmed.startsWith("[") ? trimmed : trimmed.slice(jsonStart);
  const parsed = JSON.parse(normalized);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Unexpected npm pack JSON output.");
  }

  return parsed[0];
};

const fileExists = async (filePath) => stat(filePath).then(() => true).catch(() => false);

const packInfo = parsePackJson(run("npm", ["pack", "--json"], packageDir));
const tarballPath = path.join(packageDir, packInfo.filename);
const tempRoot = await mkdtemp(path.join(tmpdir(), "zero-ts-pack-smoke-"));
const tempTarballPath = path.join(tempRoot, packInfo.filename);
const projectName = "smoke-app";
const projectDir = path.join(tempRoot, projectName);

try {
  await copyFile(tarballPath, tempTarballPath);

  run(
    "npx",
    [
      "--yes",
      "-p",
      tempTarballPath,
      "create-zero-ts",
      projectName,
      "--yes",
      "--no-install",
      "--skip-git",
    ],
    tempRoot,
  );

  const expectedCreateFiles = [
    "package.json",
    "tsconfig.json",
    "eslint.config.mjs",
    "src/index.ts",
  ];

  for (const relativePath of expectedCreateFiles) {
    const absolutePath = path.join(projectDir, relativePath);
    if (!(await fileExists(absolutePath))) {
      throw new Error(`Create smoke test missing file: ${relativePath}`);
    }
  }

  run(
    "npx",
    [
      "--yes",
      "-p",
      tempTarballPath,
      "create-zero-ts",
      "apply",
      "--cwd",
      projectDir,
      "--dry-run",
      "--yes",
      "--no-install",
      "--no-check",
    ],
    tempRoot,
  );

  const packageJsonRaw = await readFile(path.join(projectDir, "package.json"), "utf8");
  const packageJson = JSON.parse(packageJsonRaw);
  if (packageJson.name !== projectName) {
    throw new Error("Create smoke test produced unexpected package name.");
  }

  process.stdout.write("Tarball smoke test passed (create + apply dry-run).\n");
} finally {
  await Promise.all([
    rm(tarballPath, { force: true }),
    rm(tempTarballPath, { force: true }),
    rm(tempRoot, { recursive: true, force: true }),
  ]);
}
