import { select } from "@clack/prompts";
import process from "node:process";
import {
  exitOnCancel,
  formatMuted,
  formatRecommendedAction,
  formatSectionTitle,
  formatToneText,
} from "../ui.js";

export type ConflictResolution = "conflict" | "merge" | "overwrite" | "skip";
export type ConflictPromptMode = "managed-file" | "mergeable-file" | "package-json";

const buildPreview = (label: string, content: string): string => {
  const lines = content.split("\n").slice(0, 40).join("\n");
  return `${formatSectionTitle(`--- ${label} (first 40 lines) ---`)}\n${lines}\n${formatMuted(`--- end ${label} ---`)}\n`;
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
          label: formatRecommendedAction("Overwrite merged package.json"),
          value: "overwrite",
        },
        {
          label: formatMuted("Skip"),
          value: "skip",
        },
        {
          label: formatToneText("View diff preview", "info"),
          value: "preview",
        },
      ],
      yesResolution: "overwrite",
    };
  }

  if (mode === "mergeable-file") {
    return {
      initialValue: "merge",
      options: [
        {
          label: formatRecommendedAction("Merge both"),
          value: "merge",
        },
        {
          label: formatToneText("Write merge conflict markers", "warning"),
          value: "conflict",
        },
        {
          label: formatToneText("Overwrite", "success"),
          value: "overwrite",
        },
        {
          label: formatMuted("Skip"),
          value: "skip",
        },
        {
          label: formatToneText("View diff preview", "info"),
          value: "preview",
        },
      ],
      yesResolution: "merge",
    };
  }

  return {
    initialValue: "conflict",
    options: [
      {
        label: formatRecommendedAction("Write merge conflict markers"),
        value: "conflict",
      },
      {
        label: formatToneText("Overwrite", "success"),
        value: "overwrite",
      },
      {
        label: formatMuted("Skip"),
        value: "skip",
      },
      {
        label: formatToneText("View diff preview", "info"),
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
    if (
      value === "conflict" ||
      value === "merge" ||
      value === "overwrite" ||
      value === "skip"
    ) {
      return value;
    }

    process.stdout.write(buildPreview("existing", existingContent));
    process.stdout.write(buildPreview("incoming", incomingContent));
  }
};
