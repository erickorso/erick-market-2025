import { afterEach, describe, expect, it, vi } from "vitest";
import { LEGACY_KEYS, clearLegacyStorage } from "./legacyStorage";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("clearLegacyStorage", () => {
  it("removes the old league's player and board, PIN hash included", () => {
    localStorage.setItem(
      "erick-market.player.v1",
      JSON.stringify({ id: "p1", name: "Erick", pinHash: "ab12" }),
    );
    localStorage.setItem("erick-market.league.v1", '{"archives":[]}');

    clearLegacyStorage();

    for (const key of LEGACY_KEYS) expect(localStorage.getItem(key)).toBeNull();
  });

  it("leaves everything else alone", () => {
    localStorage.setItem("erick-market.theme", "light");
    localStorage.setItem("erick-market.watchlist", '["AAPL"]');

    clearLegacyStorage();

    expect(localStorage.getItem("erick-market.theme")).toBe("light");
    expect(localStorage.getItem("erick-market.watchlist")).toBe('["AAPL"]');
  });

  it("does not throw when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

    expect(() => clearLegacyStorage()).not.toThrow();
  });
});
