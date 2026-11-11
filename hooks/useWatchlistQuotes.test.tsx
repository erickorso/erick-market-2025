import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWatchlistQuotes } from "./useWatchlistQuotes";
import { LIVE_POLL_MS } from "../constants";
import type { EnrichedStock } from "../types";

const fetchQuotes = vi.hoisted(() => vi.fn());

vi.mock("../services/stockService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/stockService")>()),
  fetchQuotes,
}));

function quote(symbol: string, price: number): EnrichedStock {
  return {
    id: symbol.toLowerCase(),
    symbol,
    company: `${symbol} Corp (${symbol})`,
    price,
    changePercent: 1,
    chartData: [],
  };
}

beforeEach(() => {
  fetchQuotes.mockReset().mockImplementation(async (symbols: string[]) => ({
    stocks: symbols.map((s, i) => quote(s, 100 + i)),
    source: "live",
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useWatchlistQuotes", () => {
  it("asks for nothing when the watchlist is empty", () => {
    const { result } = renderHook(() => useWatchlistQuotes([]));

    expect(result.current.loading).toBe(false);
    expect(result.current.quotes.size).toBe(0);
    expect(fetchQuotes).not.toHaveBeenCalled();
  });

  it("loads quotes keyed by symbol", async () => {
    const { result } = renderHook(() => useWatchlistQuotes(["AAPL", "NVDA"]));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchQuotes).toHaveBeenCalledWith(["AAPL", "NVDA"]);
    expect(result.current.quotes.get("NVDA")?.price).toBe(101);
    expect(result.current.source).toBe("live");
  });

  it("keeps the last quotes on screen while a changed list loads", async () => {
    const { result, rerender } = renderHook(
      ({ symbols }) => useWatchlistQuotes(symbols),
      { initialProps: { symbols: ["AAPL", "NVDA"] } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    let answer!: (value: unknown) => void;
    fetchQuotes.mockReturnValueOnce(new Promise((r) => (answer = r)));
    rerender({ symbols: ["AAPL"] });

    expect(result.current.loading).toBe(true);
    expect(result.current.quotes.get("AAPL")?.price).toBe(100);

    await act(async () => {
      answer({ stocks: [quote("AAPL", 150)], source: "live" });
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.quotes.get("AAPL")?.price).toBe(150);
  });

  it("refreshes on the live cadence, and stops when unmounted", async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useWatchlistQuotes(["AAPL"]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchQuotes).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_POLL_MS);
    });
    expect(fetchQuotes).toHaveBeenCalledTimes(2);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_POLL_MS * 3);
    });
    expect(fetchQuotes).toHaveBeenCalledTimes(2);
  });
});
