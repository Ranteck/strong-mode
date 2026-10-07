const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cloneJsonValue = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const mergeArrayValues = (
  current: readonly unknown[],
  incoming: readonly unknown[],
): unknown[] => {
  const seen = new Set<string>();
  const merged: unknown[] = [];

  for (const value of [...current, ...incoming]) {
    const key = JSON.stringify(value);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(cloneJsonValue(value));
  }

  return merged;
};

const mergeJsonValues = (current: unknown, incoming: unknown): unknown => {
  if (Array.isArray(current) && Array.isArray(incoming)) {
    return mergeArrayValues(current, incoming);
  }

  if (isPlainObject(current) && isPlainObject(incoming)) {
    const merged = cloneJsonValue(current);

    for (const [key, incomingValue] of Object.entries(incoming)) {
      const currentValue = merged[key];
      if (currentValue === undefined) {
        merged[key] = cloneJsonValue(incomingValue);
        continue;
      }

      merged[key] = mergeJsonValues(currentValue, incomingValue);
    }

    return merged;
  }

  return cloneJsonValue(current);
};

const parseJsonObject = (source: string): Record<string, unknown> | undefined => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    return undefined;
  }

  if (!isPlainObject(parsed)) {
    return undefined;
  }

  return parsed;
};

const mergeTsconfig = (
  existingContent: string,
  incomingContent: string,
  templateOwnedKeys: readonly string[] = [],
): string | undefined => {
  const current = parseJsonObject(existingContent);
  const incoming = parseJsonObject(incomingContent);

  if (current === undefined || incoming === undefined) {
    return undefined;
  }

  const merged = mergeJsonValues(current, incoming);
  if (!isPlainObject(merged)) {
    return undefined;
  }

  for (const key of templateOwnedKeys) {
    if (key in incoming) {
      merged[key] = cloneJsonValue(incoming[key]);
    }
  }

  return `${JSON.stringify(merged, null, 2)}\n`;
};

// tsconfig.eslint.json is the program for every file ESLint lints, and `exclude`
// wins over `include`, so an exclusion kept from the project (for example
// "tests") would bring back the "file was not found in any project" parsing errors.
// Files that should not be linted are ignored through .gitignore or the ESLint
// config instead; `exclude` is the template's.
const TEMPLATE_OWNED_KEYS: Readonly<Record<string, readonly string[]>> = {
  "tsconfig.eslint.json": ["exclude"],
};

const mergeGitignore = (existingContent: string, incomingContent: string): string => {
  const lines = [
    ...existingContent.split(/\r?\n/u),
    ...incomingContent.split(/\r?\n/u),
  ];
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const line of lines) {
    const normalized = line.trim();
    if (normalized.length === 0 || seen.has(line)) {
      continue;
    }

    seen.add(line);
    merged.push(line);
  }

  return `${merged.join("\n")}\n`;
};

const TSCONFIG_FILES: readonly string[] = ["tsconfig.json", "tsconfig.eslint.json"];
// Ignore files: one pattern per line, merged by keeping every distinct line.
const LINE_LIST_FILES: readonly string[] = [".gitignore", ".prettierignore"];

export const isMergeableManagedFile = (relativePath: string): boolean =>
  TSCONFIG_FILES.includes(relativePath) || LINE_LIST_FILES.includes(relativePath);

export const mergeManagedFileContent = (
  relativePath: string,
  existingContent: string,
  incomingContent: string,
): string | undefined => {
  if (TSCONFIG_FILES.includes(relativePath)) {
    return mergeTsconfig(
      existingContent,
      incomingContent,
      TEMPLATE_OWNED_KEYS[relativePath],
    );
  }

  if (LINE_LIST_FILES.includes(relativePath)) {
    return mergeGitignore(existingContent, incomingContent);
  }

  return undefined;
};
