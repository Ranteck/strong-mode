import { describe, expect, it } from "vitest";
import { parseCliArgs } from "./args.js";

describe("parseCliArgs", (): void => {
  it("parses create flags and positional project name", (): void => {
    const parsed = parseCliArgs(["demo-app", "--pm", "pnpm", "--install", "--yes"]);

    expect(parsed.command).toBe("create");
    if (parsed.command !== "create") {
      throw new Error("Expected create command");
    }

    expect(parsed.projectName).toBe("demo-app");
    expect(parsed.packageManager).toBe("pnpm");
    expect(parsed.install).toBe(true);
    expect(parsed.yes).toBe(true);
  });

  it("parses assignment-style create flags", (): void => {
    const parsed = parseCliArgs(["--pm=npm", "--dir=./tmp/demo", "--no-install"]);

    expect(parsed.command).toBe("create");
    if (parsed.command !== "create") {
      throw new Error("Expected create command");
    }

    expect(parsed.packageManager).toBe("npm");
    expect(parsed.targetDir).toBe("./tmp/demo");
    expect(parsed.install).toBe(false);
  });

  it("parses apply command flags", (): void => {
    const parsed = parseCliArgs([
      "apply",
      "--pm",
      "yarn",
      "--cwd=./project",
      "--dry-run",
      "--backup",
      "--force",
      "--check",
      "--no-install",
    ]);

    expect(parsed.command).toBe("apply");
    if (parsed.command !== "apply") {
      throw new Error("Expected apply command");
    }

    expect(parsed.packageManager).toBe("yarn");
    expect(parsed.cwd).toBe("./project");
    expect(parsed.dryRun).toBe(true);
    expect(parsed.backup).toBe(true);
    expect(parsed.force).toBe(true);
    expect(parsed.runChecks).toBe(true);
    expect(parsed.install).toBe(false);
    expect(parsed.wizard).toBe(false);
  });

  it("parses --apply alias", (): void => {
    const parsed = parseCliArgs(["--apply", "--yes", "--no-check"]);

    expect(parsed.command).toBe("apply");
    if (parsed.command !== "apply") {
      throw new Error("Expected apply command");
    }

    expect(parsed.yes).toBe(true);
    expect(parsed.runChecks).toBe(false);
    expect(parsed.wizard).toBe(false);
  });

  it("parses --wizard for apply", (): void => {
    const parsed = parseCliArgs(["apply", "--wizard", "--cwd", "./project"]);

    expect(parsed.command).toBe("apply");
    if (parsed.command !== "apply") {
      throw new Error("Expected apply command");
    }

    expect(parsed.wizard).toBe(true);
    expect(parsed.cwd).toBe("./project");
  });

  it("parses doctor command flags", (): void => {
    const parsed = parseCliArgs(["doctor", "--pm", "bun", "--cwd=./workspace"]);

    expect(parsed.command).toBe("doctor");
    if (parsed.command !== "doctor") {
      throw new Error("Expected doctor command");
    }

    expect(parsed.packageManager).toBe("bun");
    expect(parsed.cwd).toBe("./workspace");
  });

  it("rejects positional args for doctor", (): void => {
    expect((): void => {
      parseCliArgs(["doctor", "unexpected-positional"]);
    }).toThrowError("Unknown positional argument for doctor");
  });

  it("throws on unknown flags", (): void => {
    expect((): void => {
      parseCliArgs(["--unknown"]);
    }).toThrowError("Unknown argument");
  });
});
