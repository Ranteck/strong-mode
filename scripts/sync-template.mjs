import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, "../packages/scaffold-ultra/template");
const targetDir = path.resolve(__dirname, "../packages/slop-free/template");

const run = async () => {
  await mkdir(path.dirname(targetDir), { recursive: true });
  await rm(targetDir, { recursive: true, force: true });
  await cp(sourceDir, targetDir, { recursive: true });
  process.stdout.write(`Synced template from ${sourceDir} to ${targetDir}\n`);
};

await run();
