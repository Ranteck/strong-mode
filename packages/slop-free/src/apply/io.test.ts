import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fileExists, readTextIfExists } from "./io.js";

describe("fileExists", (): void => {
  it("returns false for a path that does not exist", async (): Promise<void> => {
    const result = await fileExists("/nonexistent/path/that/does/not/exist.txt");
    expect(result).toBe(false);
  });

  it("returns true for a path that exists", async (): Promise<void> => {
    const tmpFile = path.join(os.tmpdir(), `slop-free-test-${String(Date.now())}.txt`);
    await writeFile(tmpFile, "hello");
    const result = await fileExists(tmpFile);
    expect(result).toBe(true);
  });
});

describe("readTextIfExists", (): void => {
  it("returns undefined for a file that does not exist", async (): Promise<void> => {
    const result = await readTextIfExists("/nonexistent/path/file.txt");
    expect(result).toBeUndefined();
  });

  it("returns the file content when the file exists", async (): Promise<void> => {
    const tmpFile = path.join(os.tmpdir(), `slop-free-test-${String(Date.now())}.txt`);
    await writeFile(tmpFile, "hello world");
    const result = await readTextIfExists(tmpFile);
    expect(result).toBe("hello world");
  });

  it("rethrows non-ENOENT errors", async (): Promise<void> => {
    // /dev/null is a file on Linux — reading a path beneath it causes ENOTDIR
    await expect(readTextIfExists("/dev/null/impossible")).rejects.toThrow();
  });
});
