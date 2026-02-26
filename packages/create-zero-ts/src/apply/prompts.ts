import process from "node:process";
import { select } from "@clack/prompts";
import { exitOnCancel, info } from "../ui.js";
import { formatDiff } from "./diff.js";
import { mergeContent } from "./merge.js";

export type ConflictResolution =
  | { readonly action: "overwrite"; readonly content: string }
  | { readonly action: "skip" }
  | { readonly action: "merge"; readonly content: string };

export type ConflictResolver = (
  relativePath: string,
  existingContent: string,
  incomingContent: string,
) => Promise<ConflictResolution>;

export const promptFileConflictResolution: ConflictResolver = async (
  relativePath: string,
  existingContent: string,
  incomingContent: string,
): Promise<ConflictResolution> => {
  const merged = mergeContent(relativePath, existingContent, incomingContent);
  const canMerge = merged !== undefined && merged !== existingContent;

  for (;;) {
    const mergeOption = canMerge
      ? [{ label: "Merge (keep yours + add new)", value: "merge" as const }]
      : [];

    const decision = await select({
      message: `File ${relativePath} already exists. What should apply do?`,
      initialValue: "skip",
      options: [
        ...mergeOption,
        { label: "Skip (keep current file)", value: "skip" as const },
        { label: "Overwrite (use template)", value: "overwrite" as const },
        { label: "View diff (current → template)", value: "preview" as const },
        ...(canMerge
          ? [{ label: "View merge preview", value: "merge-preview" as const }]
          : []),
      ],
    });

    const value = exitOnCancel(decision);

    if (value === "skip") {
      return { action: "skip" };
    }
    if (value === "overwrite") {
      return { action: "overwrite", content: incomingContent };
    }
    if (value === "merge" && merged !== undefined) {
      info("Merged: your settings preserved, new template entries added.");
      return { action: "merge", content: merged };
    }
    if (value === "preview") {
      process.stdout.write(formatDiff(relativePath, existingContent, incomingContent));
      process.stdout.write("\n");
    }
    if (value === "merge-preview" && merged !== undefined) {
      info("Preview of merged result (current → merged):");
      process.stdout.write(formatDiff(relativePath, existingContent, merged));
      process.stdout.write("\n");
    }
  }
};
