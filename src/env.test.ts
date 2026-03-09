import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("env", (): void => {
  beforeEach((): void => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  afterEach((): void => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("parses valid environment variables and applies defaults", async (): Promise<void> => {
    process.env.NODE_ENV = "production";
    delete process.env.LOG_LEVEL;

    const { env } = await import("./env.js");

    expect(env).toEqual({
      LOG_LEVEL: "info",
      NODE_ENV: "production",
    });
  });

  it("writes a validation error and exits on invalid input", async (): Promise<void> => {
    process.env.NODE_ENV = "invalid";

    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((): boolean => true);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((code?: string | number | null): never => {
        throw new Error(`process.exit:${code ?? ""}`);
      });

    await expect(import("./env.js")).rejects.toThrow("process.exit:1");
    expect(stderrWrite).toHaveBeenCalledWith(
      expect.stringContaining("Invalid environment configuration:"),
    );
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining("NODE_ENV"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
