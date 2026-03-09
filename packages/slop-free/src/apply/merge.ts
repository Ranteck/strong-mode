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

  return `${JSON.stringify(merged, null, 2)}\n`;
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

export const isMergeableManagedFile = (relativePath: string): boolean =>
  relativePath === "tsconfig.json" || relativePath === ".gitignore";

export const mergeManagedFileContent = (
  relativePath: string,
  existingContent: string,
  incomingContent: string,
): string | undefined => {
  if (relativePath === "tsconfig.json") {
    return mergeTsconfig(existingContent, incomingContent);
  }

  if (relativePath === ".gitignore") {
    return mergeGitignore(existingContent, incomingContent);
  }

  return undefined;
};
