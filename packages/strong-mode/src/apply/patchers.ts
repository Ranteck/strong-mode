import { LOCKSTEP_DEV_DEPENDENCIES, REPLACED_DEV_DEPENDENCIES } from "./constants.js";
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

// Scripts that `npm init` / `pnpm init` generate as placeholders. They carry no
// user intent, so the template script replaces them instead of being skipped.
const PLACEHOLDER_SCRIPTS: Readonly<Record<string, string>> = {
  test: 'echo "Error: no test specified" && exit 1',
};

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

  if (existingValue.includes(templateValue)) {
    return existingValue;
  }

  return `${existingValue} && ${templateValue}`;
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
    } else if (PLACEHOLDER_SCRIPTS[key] === previous) {
      baseScripts[key] = templateValue;
      updatedScripts.push(key);
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
  declaredElsewhere?: Record<string, string>,
): {
  readonly merged: Record<string, string>;
  readonly added: readonly string[];
} => {
  const currentDeps = normalizeDeps(current);
  const templateDeps = normalizeDeps(template);
  const added: string[] = [];

  for (const [name, version] of Object.entries(templateDeps)) {
    if (currentDeps[name] === undefined && declaredElsewhere?.[name] === undefined) {
      currentDeps[name] = version;
      added.push(name);
    }
  }

  return {
    merged: currentDeps,
    added,
  };
};

// When the project already declares a lockstep leader (vitest), the follower
// (@vitest/coverage-v8) must match whatever version the package manager resolves
// for it, which is only known after installing. Leave it out of package.json;
// execute adds it after install, pinned to the installed leader version.
const splitPostInstallLockstep = (
  devDependencies: Record<string, string>,
  addedDevDependencies: readonly string[],
  current: PackageJsonLike | undefined,
): {
  readonly devDependencies: Record<string, string>;
  readonly postInstall: readonly string[];
} => {
  const postInstall = Object.entries(LOCKSTEP_DEV_DEPENDENCIES)
    .filter(
      ([follower, leader]) =>
        addedDevDependencies.includes(follower) &&
        (current?.devDependencies?.[leader] ?? current?.dependencies?.[leader]) !==
          undefined,
    )
    .map(([follower]) => follower);

  return {
    devDependencies: Object.fromEntries(
      Object.entries(devDependencies).filter(([name]) => !postInstall.includes(name)),
    ),
    postInstall,
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
  postInstallLockstep: [],
  setModuleType: false,
  changed: JSON.stringify(before ?? {}) !== JSON.stringify(after),
});

const isDeclared = (packageJson: PackageJsonLike, name: string): boolean =>
  packageJson.devDependencies?.[name] !== undefined ||
  packageJson.dependencies?.[name] !== undefined;

const withoutPackages = (
  deps: Record<string, string>,
  names: readonly string[],
): Record<string, string> =>
  Object.fromEntries(Object.entries(deps).filter(([name]) => !names.includes(name)));

export const dropReplacedDependencies = (
  next: PackageJsonLike,
  templateFiles: ReadonlySet<string>,
): { readonly next: PackageJsonLike; readonly dropped: readonly string[] } => {
  // A runtime dependency may be imported by exported code (a shared config), so
  // only a dev-only declaration is cleaned up.
  const dropped = Object.entries(REPLACED_DEV_DEPENDENCIES)
    .filter(
      ([name, { replacement, configFile }]) =>
        next.devDependencies?.[name] !== undefined &&
        next.dependencies?.[name] === undefined &&
        isDeclared(next, replacement) &&
        templateFiles.has(configFile),
    )
    .map(([name]) => name);

  if (dropped.length === 0 || next.devDependencies === undefined) {
    return { next, dropped: [] };
  }

  return {
    next: { ...next, devDependencies: withoutPackages(next.devDependencies, dropped) },
    dropped,
  };
};

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
  // A package the project already declares as a runtime dependency also serves
  // development, so the template must not add a second, conflicting declaration.
  const mergedDevDependencies = mergeDependencies(
    current?.devDependencies,
    templatePackageJson.devDependencies,
    current?.dependencies,
  );

  next.dependencies = mergedDependencies.merged;
  const lockstep = splitPostInstallLockstep(
    mergedDevDependencies.merged,
    mergedDevDependencies.added,
    current,
  );
  next.devDependencies = lockstep.devDependencies;

  const summary: PackageJsonChangeSummary = {
    ...summarizeChanges(
      current,
      next,
      mergedScripts.addedScripts,
      mergedScripts.updatedScripts,
      mergedDependencies.added,
      mergedDevDependencies.added.filter(
        (name) => !lockstep.postInstall.includes(name),
      ),
      mergedScripts.updatedPrepareScript,
    ),
    postInstallLockstep: lockstep.postInstall,
    setModuleType: current !== undefined && typeof current.type !== "string",
  };

  return {
    path: packageJsonPath,
    exists: current !== undefined,
    current,
    next,
    summary,
  };
};
