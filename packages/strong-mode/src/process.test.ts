import { describe, expect, it, vi } from "vitest";

const { syncMock } = vi.hoisted(() => ({
  syncMock: vi.fn(),
}));

vi.mock("cross-spawn", () => ({
  default: {
    sync: syncMock,
  },
}));

import { runCommand } from "./process.js";

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
