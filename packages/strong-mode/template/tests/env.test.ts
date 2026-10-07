import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// src/env.ts validates on import, so each test stubs the environment first and
// then loads a fresh copy of the module.
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

    await expect(import("../src/env.js")).rejects.toThrow(
      /Invalid environment configuration:[\s\S]*env\.NODE_ENV[\s\S]*env\.LOG_LEVEL/u,
    );
  });
});
