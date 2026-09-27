import process from "node:process";
import spawn from "cross-spawn";

export const runCommand = (
  command: string,
  args: readonly string[],
  cwd: string,
  stdio: "inherit" | "ignore",
): void => {
  const result = spawn.sync(command, [...args], {
    cwd,
    stdio,
    shell: process.platform === "win32",
  });

  if (result.error != null) {
    throw new Error(`Failed to start command: ${command} ${args.join(" ")}`, {
      cause: result.error,
    });
  }

  if (result.status !== 0) {
    const exitCode = result.status === null ? "unknown" : String(result.status);
    const signal = result.signal ?? "none";
    throw new Error(
      `Command failed (exit ${exitCode}, signal ${signal}): ${command} ${args.join(" ")}`,
    );
  }
};

// Runs a command and returns its trimmed stdout (for small queries such as
// `yarn node -p ...`). Throws on a spawn failure or a non-zero exit.
// No shell: cross-spawn escapes each argument for cmd.exe on Windows, while a
// shell would join them unescaped and drop the quotes in the query.
export const runCommandCapture = (
  command: string,
  args: readonly string[],
  cwd: string,
): string => {
  const result = spawn.sync(command, [...args], {
    cwd,
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
  });

  if (result.error != null) {
    throw new Error(`Failed to start command: ${command} ${args.join(" ")}`, {
      cause: result.error,
    });
  }

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }

  return result.stdout.trim();
};
