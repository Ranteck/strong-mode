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

  if (result.error !== undefined) {
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
