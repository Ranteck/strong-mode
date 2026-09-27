import process from "node:process";
import { afterEach, describe, expect, it, vi } from "vitest";

const { syncMock } = vi.hoisted(() => ({
  syncMock: vi.fn(),
}));

vi.mock("cross-spawn", () => ({
  default: {
    sync: syncMock,
  },
}));

import { runCommand, runCommandCapture } from "./process.js";

describe("runCommand", (): void => {
  it("does not treat a null spawn error as a startup failure", (): void => {
    syncMock.mockReturnValue({
      error: null,
      signal: null,
      status: 0,
    });

    expect(() => {
      runCommand("npm", ["install"], "/tmp/project", "ignore");
    }).not.toThrow();
  });

  it("reports command exit failures when the child process ran", (): void => {
    syncMock.mockReturnValue({
      error: null,
      signal: null,
      status: 1,
    });

    expect(() => {
      runCommand("npm", ["install"], "/tmp/project", "ignore");
    }).toThrow("Command failed (exit 1, signal none): npm install");
  });

  it("reports startup failures when spawn returns an actual error", (): void => {
    syncMock.mockReturnValue({
      error: new Error("spawn ENOENT"),
      signal: null,
      status: null,
    });

    expect(() => {
      runCommand("npm", ["install"], "/tmp/project", "ignore");
    }).toThrow("Failed to start command: npm install");
  });
});

describe("runCommandCapture", (): void => {
  const originalPlatform = process.platform;

  afterEach((): void => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    vi.clearAllMocks();
  });

  it("runs without a shell on Windows so cross-spawn escapes the arguments", (): void => {
    Object.defineProperty(process, "platform", { value: "win32" });
    syncMock.mockReturnValue({
      error: null,
      signal: null,
      status: 0,
      stdout: "4.1.0\n",
    });

    runCommandCapture(
      "yarn",
      ["node", "-p", 'require("vitest/package.json")'],
      "/tmp/project",
    );

    expect(syncMock.mock.lastCall?.[2]).not.toHaveProperty("shell", true);
  });

  it("returns the trimmed stdout", (): void => {
    syncMock.mockReturnValue({
      error: null,
      signal: null,
      status: 0,
      stdout: "  4.1.0\n",
    });

    expect(runCommandCapture("yarn", ["node"], "/tmp/project")).toBe("4.1.0");
  });

  it("throws when the command exits with a non-zero status", (): void => {
    syncMock.mockReturnValue({ error: null, signal: null, status: 1, stdout: "" });

    expect(() => runCommandCapture("yarn", ["node"], "/tmp/project")).toThrow(
      "Command failed: yarn node",
    );
  });
});
