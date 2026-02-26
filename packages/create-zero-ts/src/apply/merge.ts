/**
 * Smart merge strategies for conflict resolution.
 *
 * - JSON files: deep merge (existing values preserved, new template keys added).
 * - Line-based files (.gitignore, .npmrc): union of unique lines.
 * - Fallback: returns undefined (caller should fall back to overwrite/skip).
 */

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const isPlainObject = (value: unknown): value is Record<string, JsonValue> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Deep-merge two JSON objects.
 * - Existing scalar values are preserved (user wins).
 * - New keys from `incoming` are added.
 * - Nested objects are merged recursively.
 * - Arrays are merged as a union (deduplicated, preserving order of existing first).
 */
const deepMerge = (existing: JsonValue, incoming: JsonValue): JsonValue => {
  if (isPlainObject(existing) && isPlainObject(incoming)) {
    const result: Record<string, JsonValue> = { ...existing };
    for (const key of Object.keys(incoming)) {
      const incomingValue = incoming[key];
      if (incomingValue === undefined) continue;
      const existingValue = result[key];
      result[key] = existingValue === undefined
        ? incomingValue
        : deepMerge(existingValue, incomingValue);
    }
    return result;
  }

  if (Array.isArray(existing) && Array.isArray(incoming)) {
    const seen = new Set(existing.map((item) => JSON.stringify(item)));
    const merged = [...existing];
    for (const item of incoming) {
      const serialized = JSON.stringify(item);
      if (!seen.has(serialized)) {
        seen.add(serialized);
        merged.push(item);
      }
    }
    return merged;
  }

  // Scalar conflict: existing wins (user's value preserved).
  return existing;
};

const mergeJson = (existingText: string, incomingText: string): string | undefined => {
  try {
    const existing = JSON.parse(existingText) as JsonValue;
    const incoming = JSON.parse(incomingText) as JsonValue;
    const merged = deepMerge(existing, incoming);
    return `${JSON.stringify(merged, null, 2)}\n`;
  } catch {
    return undefined;
  }
};

const mergeLines = (existingText: string, incomingText: string): string => {
  const existingLines = existingText.split("\n");
  const incomingLines = incomingText.split("\n");

  const seen = new Set(existingLines.map((line) => line.trim()));
  const additions: string[] = [];

  for (const line of incomingLines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && !seen.has(trimmed)) {
      seen.add(trimmed);
      additions.push(line);
    }
  }

  if (additions.length === 0) {
    return existingText;
  }

  const base = existingText.endsWith("\n") ? existingText : `${existingText}\n`;
  return `${base}${additions.join("\n")}\n`;
};

const LINE_MERGE_EXTENSIONS = new Set([".gitignore", ".npmrc", ".npmignore", ".dockerignore"]);

const isJsonFile = (relativePath: string): boolean =>
  relativePath.endsWith(".json") || relativePath.endsWith(".jsonc");

const isLineMergeFile = (relativePath: string): boolean => {
  const slashIdx = relativePath.lastIndexOf("/");
  const backslashIdx = relativePath.lastIndexOf("\\");
  const separatorIdx = Math.max(slashIdx, backslashIdx);
  const fileName = separatorIdx >= 0 ? relativePath.slice(separatorIdx + 1) : relativePath;
  return LINE_MERGE_EXTENSIONS.has(fileName);
};

/**
 * Attempt to smart-merge `existing` and `incoming` content.
 * Returns merged content string, or `undefined` if merge is not supported
 * for the given file type (caller should fall back to overwrite/skip prompt).
 */
export const mergeContent = (
  relativePath: string,
  existingContent: string,
  incomingContent: string,
): string | undefined => {
  if (isJsonFile(relativePath)) {
    return mergeJson(existingContent, incomingContent);
  }

  if (isLineMergeFile(relativePath)) {
    return mergeLines(existingContent, incomingContent);
  }

  return undefined;
};
