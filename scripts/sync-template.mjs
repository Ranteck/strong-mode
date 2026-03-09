import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, "../packages/scaffold-ultra/template");
const targetDir = path.resolve(__dirname, "../packages/strong-mode/template");
const readmeSourcePath = path.resolve(__dirname, "../README.md");
const readmeTargetPath = path.resolve(__dirname, "../packages/strong-mode/README.md");

const run = async () => {
  await mkdir(path.dirname(targetDir), { recursive: true });
  await rm(targetDir, { recursive: true, force: true });
  await cp(sourceDir, targetDir, { recursive: true });
  await cp(readmeSourcePath, readmeTargetPath);
  process.stdout.write(`Synced template from ${sourceDir} to ${targetDir}\n`);
  process.stdout.write(
    `Synced package README from ${readmeSourcePath} to ${readmeTargetPath}\n`,
  );
};

await run();
