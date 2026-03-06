import { describe, expect, it } from "vitest";
import { isErrnoException } from "./errors.js";

describe("isErrnoException", (): void => {
  it("returns true for an Error with a string code property", (): void => {
    const error = Object.assign(new Error("not found"), { code: "ENOENT" });
    expect(isErrnoException(error)).toBe(true);
  });

  it("returns false for a plain object with a code property", (): void => {
    expect(isErrnoException({ code: "ENOENT" })).toBe(false);
  });

  it("returns false for an Error without a code property", (): void => {
    expect(isErrnoException(new Error("plain error"))).toBe(false);
  });

  it("returns false for an Error with a non-string code property", (): void => {
    const error = Object.assign(new Error("numeric code"), { code: 42 });
    expect(isErrnoException(error)).toBe(false);
  });

  it("returns false for null", (): void => {
    expect(isErrnoException(null)).toBe(false);
  });

  it("returns false for undefined", (): void => {
    expect(isErrnoException(undefined)).toBe(false);
  });

  it("returns false for a string", (): void => {
    expect(isErrnoException("ENOENT")).toBe(false);
  });
});
