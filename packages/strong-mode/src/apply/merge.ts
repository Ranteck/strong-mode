import {
  applyEdits,
  modify,
  parse,
  visit,
  type ModificationOptions,
  type ParseError,
} from "jsonc-parser";
import { TYPE_CHECKING_OPTIONS } from "./constants.js";

export interface RaisedOption {
  readonly name: string;
  readonly from: unknown;
  readonly to: unknown;
}

export interface MergeResult {
  readonly content: string;
  readonly raisedOptions: readonly RaisedOption[];
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cloneJsonValue = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const mergeArrayValues = (
  current: readonly unknown[],
  incoming: readonly unknown[],
): unknown[] => {
  const seen = new Set(current.map((value): string => JSON.stringify(value)));
  const merged = current.map((value): unknown => cloneJsonValue(value));

  for (const value of incoming) {
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

type KeyPath = readonly string[];

const parseJsoncObject = (source: string): Record<string, unknown> | undefined => {
  const objectKeys: Set<string>[] = [];
  const validation = { unsafeKeys: false };
  // Validate before parse can collapse duplicate keys or assign a prototype.
  visit(
    source,
    {
      onObjectBegin: (): void => {
        objectKeys.push(new Set<string>());
      },
      onObjectProperty: (key): void => {
        const keys = objectKeys.at(-1);
        if (key === "__proto__" || keys?.has(key)) {
          validation.unsafeKeys = true;
        }
        keys?.add(key);
      },
      onObjectEnd: (): void => {
        objectKeys.pop();
      },
    },
    { allowTrailingComma: true },
  );
  if (validation.unsafeKeys) {
    return undefined;
  }

  const errors: ParseError[] = [];
  const parsed: unknown = parse(source, errors, { allowTrailingComma: true });

  if (errors.length !== 0 || !isPlainObject(parsed)) {
    return undefined;
  }

  const compilerOptions = parsed.compilerOptions;
  return compilerOptions === undefined || isPlainObject(compilerOptions)
    ? parsed
    : undefined;
};

const valueAt = (root: unknown, keyPath: KeyPath): unknown => {
  let value = root;
  for (const key of keyPath) {
    if (!isPlainObject(value)) {
      return undefined;
    }
    value = value[key];
  }

  return value;
};

const isSameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const MODIFY_OPTIONS: ModificationOptions = {
  formattingOptions: { insertSpaces: true, tabSize: 2 },
};

// The merge never removes keys, so walking the target is enough. Descending into
// objects avoids replacing their comments and formatting when one value changes.
const applyDifferences = (
  text: string,
  current: unknown,
  target: unknown,
  keyPath: KeyPath,
  templateOwnedPaths: readonly KeyPath[],
): string => {
  if (isPlainObject(current) && isPlainObject(target)) {
    let next = text;
    for (const [key, value] of Object.entries(target)) {
      next = applyDifferences(
        next,
        current[key],
        value,
        [...keyPath, key],
        templateOwnedPaths,
      );
    }
    return next;
  }

  if (
    Array.isArray(current) &&
    Array.isArray(target) &&
    !templateOwnedPaths.some((ownedPath): boolean => isSameJson(ownedPath, keyPath))
  ) {
    let next = text;
    const additions: unknown[] = target.slice(current.length);
    // Unioned arrays keep the project's prefix, including duplicates and comments.
    for (const value of additions) {
      next = applyEdits(
        next,
        modify(next, [...keyPath, -1], value, {
          ...MODIFY_OPTIONS,
          isArrayInsertion: true,
        }),
      );
    }
    return next;
  }

  return isSameJson(current, target)
    ? text
    : applyEdits(text, modify(text, [...keyPath], target, MODIFY_OPTIONS));
};

const raisedTypeCheckingOptions = (
  current: Record<string, unknown>,
  merged: Record<string, unknown>,
): RaisedOption[] =>
  TYPE_CHECKING_OPTIONS.flatMap((name): RaisedOption[] => {
    const from = valueAt(current, ["compilerOptions", name]);
    const to = valueAt(merged, ["compilerOptions", name]);
    return from === undefined || isSameJson(from, to) ? [] : [{ name, from, to }];
  });

const mergeTsconfig = (
  existingContent: string,
  incomingContent: string,
  templateOwnedPaths: readonly KeyPath[] = [],
): MergeResult | undefined => {
  const bom = existingContent.startsWith("\uFEFF") ? "\uFEFF" : "";
  const existingText = existingContent.slice(bom.length);
  const incomingText = incomingContent.startsWith("\uFEFF")
    ? incomingContent.slice(1)
    : incomingContent;
  const current = parseJsoncObject(existingText);
  const incoming = parseJsoncObject(incomingText);

  if (current === undefined || incoming === undefined) {
    return undefined;
  }

  const merged = mergeJsonValues(current, incoming);
  if (!isPlainObject(merged)) {
    return undefined;
  }

  for (const ownedPath of templateOwnedPaths) {
    const templateValue = valueAt(incoming, ownedPath);
    const parent = valueAt(merged, ownedPath.slice(0, -1));
    const key = ownedPath.at(-1);
    if (templateValue !== undefined && isPlainObject(parent) && key !== undefined) {
      parent[key] = cloneJsonValue(templateValue);
    }
  }

  const content = applyDifferences(
    existingText,
    current,
    merged,
    [],
    templateOwnedPaths,
  );
  if (!isSameJson(parseJsoncObject(content), merged)) {
    return undefined;
  }

  return {
    content: bom + content,
    raisedOptions: raisedTypeCheckingOptions(current, merged),
  };
};

const TEMPLATE_OWNED_PATHS: Readonly<Record<string, readonly KeyPath[]>> = {
  // Type-checking options are the approved exception to keeping project values.
  "tsconfig.json": TYPE_CHECKING_OPTIONS.map(
    (option): KeyPath => ["compilerOptions", option],
  ),
  // An exclusion kept from the project could drop linted files out of the program.
  // Files that should not be linted are ignored through .gitignore or ESLint instead.
  "tsconfig.eslint.json": [["exclude"]],
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
): MergeResult | undefined => {
  if (TSCONFIG_FILES.includes(relativePath)) {
    return mergeTsconfig(
      existingContent,
      incomingContent,
      TEMPLATE_OWNED_PATHS[relativePath],
    );
  }

  if (LINE_LIST_FILES.includes(relativePath)) {
    return {
      content: mergeGitignore(existingContent, incomingContent),
      raisedOptions: [],
    };
  }

  return undefined;
};
