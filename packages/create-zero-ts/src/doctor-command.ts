import { access, constants, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import { detectPackageManager, packageManagerLabel } from "./package-manager.js";
import type { DoctorCliOptions } from "./types.js";

type DoctorStatus = "ok" | "warn" | "fail";

interface DoctorCheck {
  readonly label: string;
  readonly status: DoctorStatus;
  readonly detail: string;
}

const MIN_SUPPORTED_NODE_MAJOR = 22;

const statusPrefix = (status: DoctorStatus): string => {
  switch (status) {
    case "ok":
      return "[ok]";
    case "warn":
      return "[warn]";
    case "fail":
      return "[fail]";
    default: {
      const neverStatus: never = status;
      return neverStatus;
    }
  }
};

const parseNodeMajor = (version: string): number => {
  const parsed = Number.parseInt(version.split(".")[0] ?? "", 10);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return parsed;
};

const commandAvailable = (command: string): boolean => {
  const result = spawnSync(`${command} --version`, {
    stdio: "ignore",
    shell: true,
  });

  return result.status === 0;
};

const runGitWithOutput = (
  args: readonly string[],
  cwd: string,
): SpawnSyncReturns<string> =>
  spawnSync("git", [...args], {
    cwd,
    encoding: "utf8",
  });

const canWriteDirectory = async (directoryPath: string): Promise<boolean> => {
  const directoryStats = await stat(directoryPath).catch(() => null);
  if (!directoryStats?.isDirectory()) {
    return false;
  }

  return access(directoryPath, constants.W_OK).then(() => true).catch(() => false);
};

type GitState = "clean" | "dirty" | "not_repo" | "unavailable";

const inspectGitState = (cwd: string): GitState => {
  if (!commandAvailable("git")) {
    return "unavailable";
  }

  const insideWorkTree = runGitWithOutput(["rev-parse", "--is-inside-work-tree"], cwd);
  if (insideWorkTree.error instanceof Error) {
    return "unavailable";
  }

  if (insideWorkTree.status !== 0 || insideWorkTree.stdout.trim() !== "true") {
    return "not_repo";
  }

  const gitStatus = runGitWithOutput(["status", "--porcelain"], cwd);
  if (gitStatus.error instanceof Error) {
    return "unavailable";
  }

  if (gitStatus.status !== 0) {
    return "unavailable";
  }

  return gitStatus.stdout.trim().length > 0 ? "dirty" : "clean";
};

const renderGitCheck = (state: GitState): DoctorCheck => {
  switch (state) {
    case "clean":
      return {
        label: "Git working tree",
        status: "ok",
        detail: "Repository is clean.",
      };
    case "dirty":
      return {
        label: "Git working tree",
        status: "warn",
        detail: "Repository has uncommitted changes.",
      };
    case "not_repo":
      return {
        label: "Git working tree",
        status: "warn",
        detail: "Directory is not a git repository.",
      };
    case "unavailable":
      return {
        label: "Git working tree",
        status: "warn",
        detail: "git is unavailable; skipped repository cleanliness check.",
      };
    default: {
      const neverState: never = state;
      return neverState;
    }
  }
};

export interface DoctorCommandResult {
  readonly lines: readonly string[];
  readonly exitCode: number;
}

export const runDoctorCommand = async (options: DoctorCliOptions): Promise<DoctorCommandResult> => {
  const targetDir = path.resolve(process.cwd(), options.cwd ?? ".");
  const packageManager = options.packageManager ?? detectPackageManager(targetDir);
  const nodeMajor = parseNodeMajor(process.versions.node);

  const checks: DoctorCheck[] = [];

  checks.push(
    nodeMajor >= MIN_SUPPORTED_NODE_MAJOR
      ? {
          label: "Node.js version",
          status: "ok",
          detail: `Detected ${process.versions.node} (requires >= ${String(MIN_SUPPORTED_NODE_MAJOR)}).`,
        }
      : {
          label: "Node.js version",
          status: "fail",
          detail: `Detected ${process.versions.node} (requires >= ${String(MIN_SUPPORTED_NODE_MAJOR)}).`,
        },
  );

  checks.push(
    commandAvailable(packageManager)
      ? {
          label: "Package manager",
          status: "ok",
          detail: `${packageManagerLabel(packageManager)} is available.`,
        }
      : {
          label: "Package manager",
          status: "fail",
          detail: `${packageManagerLabel(packageManager)} is not available in PATH.`,
        },
  );

  checks.push(
    (await canWriteDirectory(targetDir))
      ? {
          label: "Workspace access",
          status: "ok",
          detail: `Writable directory: ${targetDir}`,
        }
      : {
          label: "Workspace access",
          status: "fail",
          detail: `Cannot write in directory: ${targetDir}`,
        },
  );

  checks.push(renderGitCheck(inspectGitState(targetDir)));

  const failureCount = checks.filter((check) => check.status === "fail").length;
  const warningCount = checks.filter((check) => check.status === "warn").length;

  const lines: string[] = [
    "Doctor report:",
    ...checks.map(
      (check) => `  ${statusPrefix(check.status)} ${check.label}: ${check.detail}`,
    ),
    "",
    `Summary: ${String(failureCount)} failure(s), ${String(warningCount)} warning(s).`,
    failureCount > 0 ? "Doctor failed. Resolve failures before publishing." : "Doctor passed.",
  ];

  return {
    lines,
    exitCode: failureCount > 0 ? 1 : 0,
  };
};
