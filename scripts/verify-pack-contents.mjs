import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageDir = path.resolve(__dirname, "../packages/create-zero-ts");
const packageJsonPath = path.join(packageDir, "package.json");

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
    const stderr = result.stderr?.trim() ?? "";
    const stdout = result.stdout?.trim() ?? "";
    throw new Error(
      `Command failed (${fullCommand}): ${stderr || stdout || errorMessage || "no output"}`,
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

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

const packOutput = run("npm", ["pack", "--json"], packageDir);
const packInfo = parsePackJson(packOutput);
const tarballPath = path.join(packageDir, packInfo.filename);

try {
  const packedFiles = Array.isArray(packInfo.files)
    ? packInfo.files.map((file) => String(file.path))
    : [];

  const hasDist = packedFiles.some((filePath) => filePath.startsWith("dist/"));
  const hasTemplate = packedFiles.some((filePath) => filePath.startsWith("template/"));

  if (!hasDist) {
    throw new Error("Packed tarball does not include dist/ files.");
  }

  if (!hasTemplate) {
    throw new Error("Packed tarball does not include template/ files.");
  }

  const binEntries = Object.values(packageJson.bin ?? {});
  for (const binPath of binEntries) {
    if (typeof binPath !== "string") {
      continue;
    }

    if (!packedFiles.includes(binPath)) {
      throw new Error(`Packed tarball is missing bin target: ${binPath}`);
    }
  }

  process.stdout.write(
    `Pack verification passed. Tarball includes dist/, template/, and ${String(binEntries.length)} bin target(s).\n`,
  );
} finally {
  await rm(tarballPath, { force: true });
}
