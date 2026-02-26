#!/usr/bin/env node

import { cancel, intro, outro } from "@clack/prompts";
import process from "node:process";
import color from "picocolors";
import { parseCliArgs } from "./args.js";
import { runApplyCommand } from "./apply-command.js";
import { runCreateCommand } from "./create-command.js";
import { runDoctorCommand } from "./doctor-command.js";
import { formatError } from "./ui.js";

const run = async (): Promise<void> => {
  intro("zero-ts");

  const options = parseCliArgs(process.argv.slice(2));
  if (options.command === "doctor") {
    const result = await runDoctorCommand(options);
    outro(result.lines.join("\n"));
    if (result.exitCode !== 0) {
      process.exit(result.exitCode);
    }
    return;
  }

  const lines = options.command === "apply"
    ? await runApplyCommand(options)
    : await runCreateCommand(options);

  outro(lines.join("\n"));
};

await run().catch((error: unknown): never => {
  cancel(color.red(`Failed: ${formatError(error)}`));
  process.exit(1);
});
