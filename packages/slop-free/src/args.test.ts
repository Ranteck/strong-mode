import { describe, expect, it } from "vitest";
import { parseCliArgs } from "./args.js";

describe("parseCliArgs", (): void => {
  it("parses apply flags", (): void => {
    const parsed = parseCliArgs([
      "--pm", "yarn",
      "--cwd=./project",
      "--dry-run",
      "--backup",
      "--force",
      "--check",
      "--no-install",
    ]);

    expect(parsed.packageManager).toBe("yarn");
    expect(parsed.cwd).toBe("./project");
    expect(parsed.dryRun).toBe(true);
    expect(parsed.backup).toBe(true);
    expect(parsed.force).toBe(true);
    expect(parsed.runChecks).toBe(true);
    expect(parsed.install).toBe(false);
  });

  it("throws on unknown flags", (): void => {
    expect((): void => {
      parseCliArgs(["--unknown"]);
    }).toThrowError("Unknown argument");
  });

  it("reports missing value when --pm is followed by another flag", (): void => {
    expect((): void => {
      parseCliArgs(["--pm", "--yes"]);
    }).toThrowError("Missing value for --pm");
  });

  it("throws on unsupported package manager (space-separated)", (): void => {
    expect((): void => {
      parseCliArgs(["--pm", "cargo"]);
    }).toThrowError("Unsupported package manager");
  });

  it("throws on unsupported package manager (assignment-style)", (): void => {
    expect((): void => {
      parseCliArgs(["--pm=pip"]);
    }).toThrowError("Unsupported package manager");
  });

  it("throws on positional argument in apply command", (): void => {
    expect((): void => {
      parseCliArgs(["apply", "some-dir"]);
    }).toThrowError("Unknown positional argument for apply");
  });

  it("produces all-false defaults when no flags are supplied", (): void => {
    const result = parseCliArgs([]);
    expect(result.command).toBe("apply");
    expect(result.yes).toBe(false);
    expect(result.dryRun).toBe(false);
    expect(result.backup).toBe(false);
    expect(result.force).toBe(false);
    expect(result.cwd).toBeUndefined();
    expect(result.packageManager).toBeUndefined();
    expect(result.install).toBeUndefined();
    expect(result.runChecks).toBeUndefined();
  });

  it("throws when --cwd is the last argument", (): void => {
    expect((): void => {
      parseCliArgs(["--cwd"]);
    }).toThrowError("Missing value for --cwd");
  });

  it("throws when --cwd is followed by another flag", (): void => {
    expect((): void => {
      parseCliArgs(["--cwd", "--dry-run"]);
    }).toThrowError("Missing value for --cwd");
  });

  it("throws when --cwd= has an empty value", (): void => {
    expect((): void => {
      parseCliArgs(["--cwd="]);
    }).toThrowError("Missing value for --cwd");
  });

  it("parses --no-check as runChecks false", (): void => {
    const result = parseCliArgs(["--no-check"]);
    expect(result.runChecks).toBe(false);
  });
});
