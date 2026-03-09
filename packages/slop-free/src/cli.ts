import { intro, outro } from "@clack/prompts";
import process from "node:process";
import color from "picocolors";
import { parseCliArgs } from "./args.js";
import { runApplyCommand } from "./apply-command.js";
import { formatError, formatIntroTitle } from "./ui.js";

const run = async (): Promise<void> => {
  intro(formatIntroTitle());

  const options = parseCliArgs(process.argv.slice(2));
  const lines = await runApplyCommand(options);

  outro(lines.join("\n"));
};

await run().catch((error: unknown): void => {
  process.stderr.write(color.red(`\nFailed: ${formatError(error)}\n`), () => {
    process.exit(1);
  });
});
