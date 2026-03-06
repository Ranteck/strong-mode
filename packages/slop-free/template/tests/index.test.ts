import { describe, expect, it } from "vitest";
import { parseIncomingPayload } from "../src/index.js";

describe("parseIncomingPayload", (): void => {
  it("accepts valid input", (): void => {
    const parsed = parseIncomingPayload({
      id: "550e8400-e29b-41d4-a716-446655440000",
      active: true,
    });

    expect(parsed.active).toBe(true);
  });

  it("rejects unknown fields", (): void => {
    expect((): void => {
      parseIncomingPayload({
        id: "550e8400-e29b-41d4-a716-446655440000",
        active: true,
        extra: "not-allowed",
      });
    }).toThrow();
  });
});
