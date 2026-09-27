import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// src/env.ts validates on import, so each test stubs the environment first and
// then loads a fresh copy of the module. Always read a named member of the dynamic
// import: a bare `import()` counts as using every export, which would hide dead
// exports in src/env.ts from knip.
const loadEnv = async (): Promise<unknown> => {
  const { env } = await import("../src/env.js");
  return env;
};

describe("env", (): void => {
  beforeEach((): void => {
    vi.resetModules();
  });

  afterEach((): void => {
    vi.unstubAllEnvs();
  });

  it("exposes validated environment variables", async (): Promise<void> => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOG_LEVEL", "debug");

    const { env } = await import("../src/env.js");

    expect(env).toEqual({ NODE_ENV: "production", LOG_LEVEL: "debug" });
  });

  it("rejects invalid values and names every invalid variable", async (): Promise<void> => {
    vi.stubEnv("NODE_ENV", "invalid");
    vi.stubEnv("LOG_LEVEL", "verbose");

    await expect(loadEnv()).rejects.toThrow(
      /Invalid environment configuration:[\s\S]*env\.NODE_ENV[\s\S]*env\.LOG_LEVEL/u,
    );
  });
});
