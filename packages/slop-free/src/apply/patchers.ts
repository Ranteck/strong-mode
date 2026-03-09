import type {
  PackageJsonChangeSummary,
  PackageJsonLike,
  PackageJsonPlan,
} from "./types.js";

const KNOWN_SCRIPT_KEYS: readonly string[] = [
  "build",
  "typecheck",
  "lint",
  "lint:fix",
  "format",
  "format:check",
  "test",
  "test:watch",
  "test:coverage",
  "dead-code",
  "deps:graph",
  "deps:cycles",
  "audit",
  "check",
  "quality",
  "prepare",
];

const clonePackageJson = (value: PackageJsonLike | undefined): PackageJsonLike =>
  value === undefined ? {} : (JSON.parse(JSON.stringify(value)) as PackageJsonLike);

const normalizeDeps = (
  deps: Record<string, string> | undefined,
): Record<string, string> => (deps === undefined ? {} : { ...deps });

const mergePrepareScript = (
  existingValue: string | undefined,
  templateValue: string,
): string => {
  if (existingValue === undefined || existingValue.length === 0) {
    return templateValue;
  }

  if (existingValue.includes("lefthook install")) {
    return existingValue;
  }

  return `${existingValue} && lefthook install`;
};

const mergeScripts = (
  currentScripts: Record<string, string> | undefined,
  templateScripts: Record<string, string> | undefined,
): {
  readonly scripts: Record<string, string>;
  readonly addedScripts: readonly string[];
  readonly updatedScripts: readonly string[];
  readonly updatedPrepareScript: boolean;
} => {
  const baseScripts: Record<string, string> = {
    ...(currentScripts ?? {}),
  };

  const addedScripts: string[] = [];
  const updatedScripts: string[] = [];
  let updatedPrepareScript = false;

  for (const key of KNOWN_SCRIPT_KEYS) {
    const templateValue = templateScripts?.[key];
    if (templateValue === undefined) {
      continue;
    }

    const previous = baseScripts[key];
    if (key === "prepare") {
      const mergedPrepare = mergePrepareScript(previous, templateValue);
      baseScripts[key] = mergedPrepare;
      if (previous === undefined) {
        addedScripts.push(key);
      } else if (previous !== mergedPrepare) {
        updatedScripts.push(key);
        updatedPrepareScript = true;
      }
      continue;
    }

    if (previous === undefined) {
      baseScripts[key] = templateValue;
      addedScripts.push(key);
    }
  }

  return {
    scripts: baseScripts,
    addedScripts,
    updatedScripts,
    updatedPrepareScript,
  };
};

const mergeDependencies = (
  current: Record<string, string> | undefined,
  template: Record<string, string> | undefined,
): {
  readonly merged: Record<string, string>;
  readonly added: readonly string[];
} => {
  const currentDeps = normalizeDeps(current);
  const templateDeps = normalizeDeps(template);
  const added: string[] = [];

  for (const [name, version] of Object.entries(templateDeps)) {
    if (currentDeps[name] === undefined) {
      currentDeps[name] = version;
      added.push(name);
    }
  }

  return {
    merged: currentDeps,
    added,
  };
};

const summarizeChanges = (
  before: PackageJsonLike | undefined,
  after: PackageJsonLike,
  addedScripts: readonly string[],
  updatedScripts: readonly string[],
  addedDependencies: readonly string[],
  addedDevDependencies: readonly string[],
  updatedPrepareScript: boolean,
): PackageJsonChangeSummary => ({
  addedScripts,
  updatedScripts,
  addedDependencies,
  addedDevDependencies,
  updatedPrepareScript,
  changed: JSON.stringify(before ?? {}) !== JSON.stringify(after),
});

export const buildPackageJsonPlan = (
  packageJsonPath: string,
  current: PackageJsonLike | undefined,
  templatePackageJson: PackageJsonLike,
  fallbackName: string,
): PackageJsonPlan => {
  const next = clonePackageJson(current);
  next.name = typeof current?.name === "string" ? current.name : fallbackName;
  next.version = typeof current?.version === "string" ? current.version : "0.1.0";
  next.type = typeof current?.type === "string" ? current.type : "module";
  next.private = typeof current?.private === "boolean" ? current.private : true;
  next.engines = {
    ...(current?.engines ?? {}),
    ...(templatePackageJson.engines ?? {}),
  };

  const mergedScripts = mergeScripts(current?.scripts, templatePackageJson.scripts);
  next.scripts = mergedScripts.scripts;

  const mergedDependencies = mergeDependencies(
    current?.dependencies,
    templatePackageJson.dependencies,
  );
  const mergedDevDependencies = mergeDependencies(
    current?.devDependencies,
    templatePackageJson.devDependencies,
  );

  next.dependencies = mergedDependencies.merged;
  next.devDependencies = mergedDevDependencies.merged;

  const summary = summarizeChanges(
    current,
    next,
    mergedScripts.addedScripts,
    mergedScripts.updatedScripts,
    mergedDependencies.added,
    mergedDevDependencies.added,
    mergedScripts.updatedPrepareScript,
  );

  return {
    path: packageJsonPath,
    exists: current !== undefined,
    current,
    next,
    summary,
  };
};
