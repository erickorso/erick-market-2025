import { afterEach, describe, expect, it, vi } from "vitest";
import { newIdempotencyKey } from "./idempotency";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("newIdempotencyKey", () => {
  it("uses the platform UUID when there is one", () => {
    const randomUUID = vi.fn().mockReturnValue("uuid-from-platform");
    vi.stubGlobal("crypto", { randomUUID });

    expect(newIdempotencyKey()).toBe("uuid-from-platform");
  });

  it("returns a different key every time", () => {
    const keys = new Set(Array.from({ length: 50 }, newIdempotencyKey));
    expect(keys.size).toBe(50);
  });

  // A key that failed to generate would turn every trade into a 400, so the
  // fallback exists rather than assuming a secure context.
  it("falls back when randomUUID is missing", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(0xab);
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    expect(newIdempotencyKey()).toBe("ab".repeat(16));
  });

  it("falls back again when there is no crypto at all", () => {
    vi.stubGlobal("crypto", undefined);

    const key = newIdempotencyKey();
    expect(key).toHaveLength(32);
    expect(key).toMatch(/^[0-9a-f]+$/);
  });

  it("always produces something the server will accept", () => {
    // Mirrors parseIdempotencyKey on the API side.
    for (let i = 0; i < 20; i++) {
      const key = newIdempotencyKey();
      expect(key.length).toBeGreaterThanOrEqual(8);
      expect(key.length).toBeLessThanOrEqual(128);
      expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});
