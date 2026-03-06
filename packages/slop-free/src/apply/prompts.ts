import { select } from "@clack/prompts";
import process from "node:process";
import { exitOnCancel } from "../ui.js";

export type ConflictResolution = "overwrite" | "skip";

const buildPreview = (label: string, content: string): string => {
  const lines = content.split("\n").slice(0, 40).join("\n");
  return `--- ${label} (first 40 lines) ---\n${lines}\n--- end ${label} ---\n`;
};

export const promptFileConflictResolution = async (
  relativePath: string,
  existingContent: string,
  incomingContent: string,
  yes: boolean,
  force: boolean,
): Promise<ConflictResolution> => {
  if (force || yes) {
    return "overwrite";
  }

  for (;;) {
    const decision = await select({
      message: `File ${relativePath} already exists. What should apply do?`,
      initialValue: "overwrite",
      options: [
        {
          label: "Overwrite (recommended)",
          value: "overwrite",
        },
        {
          label: "Skip",
          value: "skip",
        },
        {
          label: "View diff preview",
          value: "preview",
        },
      ],
    });

    const value = exitOnCancel(decision);
    if (value === "overwrite" || value === "skip") {
      return value;
    }

    process.stdout.write(buildPreview("existing", existingContent));
    process.stdout.write(buildPreview("incoming", incomingContent));
  }
};
