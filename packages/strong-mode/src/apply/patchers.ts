import { satisfies, validRange } from "semver";
import { LOCKSTEP_DEV_DEPENDENCIES } from "./constants.js";
import type {
  InstalledVersion,
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

// Picks the follower specifier for a project that declares the leader: the
// installed leader version when it satisfies the declared range (lockfiles can
// keep an older leader than the newest follower in range), else the declared
// range. Non-semver specifiers (dist-tags, git, tarballs, paths, protocols)
// cannot be reused for another package, so they return undefined.
const resolveFollowerSpecifier = (
  leaderRange: string | undefined,
  installedLeader: InstalledVersion | undefined,
): string | undefined => {
  if (leaderRange === undefined) {
    return undefined;
  }

  // A non-semver specifier (catalog:, workspace:, dist-tag, git, path) cannot be
  // reused for another package; only the version it installed in this package is
  // safe. A version inherited from a workspace root cannot be matched to it.
  if (validRange(leaderRange) === null) {
    return installedLeader?.inProject === true ? installedLeader.version : undefined;
  }

  if (
    installedLeader !== undefined &&
    satisfies(installedLeader.version, leaderRange)
  ) {
    return installedLeader.version;
  }

  return leaderRange;
};

const alignLockstepDevDependencies = (
  devDependencies: Record<string, string>,
  addedDevDependencies: readonly string[],
  current: PackageJsonLike | undefined,
  installedVersions: Readonly<Record<string, InstalledVersion>>,
): {
  readonly aligned: Record<string, string>;
  // Followers not added because the project declares the leader with a specifier
  // that cannot be matched and nothing is installed: writing the template range
  // would create a mismatched pair that a later re-run could not repair.
  readonly deferred: readonly string[];
} => {
  const aligned = { ...devDependencies };
  const deferred: string[] = [];

  for (const [follower, leader] of Object.entries(LOCKSTEP_DEV_DEPENDENCIES)) {
    if (!addedDevDependencies.includes(follower)) {
      continue;
    }

    const leaderRange =
      current?.devDependencies?.[leader] ?? current?.dependencies?.[leader];
    const specifier = resolveFollowerSpecifier(leaderRange, installedVersions[leader]);
    if (specifier !== undefined) {
      aligned[follower] = specifier;
    } else if (leaderRange !== undefined) {
      deferred.push(follower);
    }
  }

  return {
    aligned: Object.fromEntries(
      Object.entries(aligned).filter(([name]) => !deferred.includes(name)),
    ),
    deferred,
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
  deferredLockstep: [],
  changed: JSON.stringify(before ?? {}) !== JSON.stringify(after),
});

export const buildPackageJsonPlan = (
  packageJsonPath: string,
  current: PackageJsonLike | undefined,
  templatePackageJson: PackageJsonLike,
  fallbackName: string,
  installedVersions: Readonly<Record<string, InstalledVersion>> = {},
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
  const lockstep = alignLockstepDevDependencies(
    mergedDevDependencies.merged,
    mergedDevDependencies.added,
    current,
    installedVersions,
  );
  next.devDependencies = lockstep.aligned;

  const summary: PackageJsonChangeSummary = {
    ...summarizeChanges(
      current,
      next,
      mergedScripts.addedScripts,
      mergedScripts.updatedScripts,
      mergedDependencies.added,
      mergedDevDependencies.added.filter((name) => !lockstep.deferred.includes(name)),
      mergedScripts.updatedPrepareScript,
    ),
    deferredLockstep: lockstep.deferred,
  };

  return {
    path: packageJsonPath,
    exists: current !== undefined,
    current,
    next,
    summary,
  };
};
