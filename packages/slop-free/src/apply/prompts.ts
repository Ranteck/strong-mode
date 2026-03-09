import { select } from "@clack/prompts";
import process from "node:process";
import color from "picocolors";
import { exitOnCancel } from "../ui.js";

export type ConflictResolution = "conflict" | "overwrite" | "skip";
export type ConflictPromptMode = "managed-file" | "package-json";

const buildPreview = (label: string, content: string): string => {
  const lines = content.split("\n").slice(0, 40).join("\n");
  return `${color.bold(color.cyan(`--- ${label} (first 40 lines) ---`))}\n${lines}\n${color.dim(`--- end ${label} ---`)}\n`;
};

const promptOptionsForMode = (
  mode: ConflictPromptMode,
): {
  readonly initialValue: ConflictResolution;
  readonly options: readonly {
    readonly label: string;
    readonly value: ConflictResolution | "preview";
  }[];
  readonly yesResolution: ConflictResolution;
} => {
  if (mode === "package-json") {
    return {
      initialValue: "overwrite",
      options: [
        {
          label: `${color.green("Overwrite merged package.json")} ${color.dim("(recommended)")}`,
          value: "overwrite",
        },
        {
          label: color.dim("Skip"),
          value: "skip",
        },
        {
          label: color.cyan("View diff preview"),
          value: "preview",
        },
      ],
      yesResolution: "overwrite",
    };
  }

  return {
    initialValue: "conflict",
    options: [
      {
        label: `${color.yellow("Write merge conflict markers")} ${color.dim("(recommended)")}`,
        value: "conflict",
      },
      {
        label: color.green("Overwrite"),
        value: "overwrite",
      },
      {
        label: color.dim("Skip"),
        value: "skip",
      },
      {
        label: color.cyan("View diff preview"),
        value: "preview",
      },
    ],
    yesResolution: "conflict",
  };
};

export const promptFileConflictResolution = async (
  relativePath: string,
  existingContent: string,
  incomingContent: string,
  yes: boolean,
  force: boolean,
  mode: ConflictPromptMode,
): Promise<ConflictResolution> => {
  const promptOptions = promptOptionsForMode(mode);

  if (force) {
    return "overwrite";
  }

  if (yes) {
    return promptOptions.yesResolution;
  }

  for (;;) {
    const decision = await select({
      message: `File ${relativePath} already exists. What should apply do?`,
      initialValue: promptOptions.initialValue,
      options: [...promptOptions.options],
    });

    const value = exitOnCancel(decision);
    if (value === "conflict" || value === "overwrite" || value === "skip") {
      return value;
    }

    process.stdout.write(buildPreview("existing", existingContent));
    process.stdout.write(buildPreview("incoming", incomingContent));
  }
};
