import { beforeEach, describe, expect, it } from "vitest";
import {
  WATCHLIST_STORAGE_KEY,
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
} from "./localWatchlist";

describe("localWatchlist", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds a symbol, reads it back from localStorage, and removes it", () => {
    expect(getWatchlist()).toEqual([]);

    addToWatchlist("aapl");

    expect(getWatchlist()).toEqual(["AAPL"]);
    expect(localStorage.getItem("erick-market.watchlist")).toBe('["AAPL"]');
    expect(WATCHLIST_STORAGE_KEY).toBe("erick-market.watchlist");

    removeFromWatchlist("AAPL");

    expect(getWatchlist()).toEqual([]);
    expect(localStorage.getItem("erick-market.watchlist")).toBeNull();
  });
});
