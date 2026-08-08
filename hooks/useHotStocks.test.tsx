import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHotStocks } from "./useHotStocks";
import { HOT_REFRESH_MS } from "../constants";

const fetchMock = vi.fn();

function payload(stocks: unknown[], at = 1_700_000_000_000) {
  return {
    ok: true,
    json: async () => ({ type: "hot", at, source: "live", stocks }),
  } as Response;
}

const live = [
  { symbol: "ABNB", company: "Airbnb", price: 178.07, changePercent: 17.43 },
  { symbol: "UBER", company: "Uber", price: 75.02, changePercent: 6.46 },
];

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(payload(live));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("polling", () => {
  it("fetches the movers on mount", async () => {
    const { result } = renderHook(() => useHotStocks());

    await waitFor(() => expect(result.current.stocks).toHaveLength(2));
    expect(result.current.stocks[0].symbol).toBe("ABNB");
  });

  it("reports that it is polling", async () => {
    const { result } = renderHook(() => useHotStocks());
    await waitFor(() => expect(result.current.mode).toBe("poll"));
  });

  it("starts idle before the first response", () => {
    const { result } = renderHook(() => useHotStocks());
    expect(result.current.mode).toBe("idle");
  });

  it("records when the data arrived", async () => {
    const { result } = renderHook(() => useHotStocks());
    await waitFor(() => expect(result.current.updatedAt).toBe(1_700_000_000_000));
  });

  it("exposes its own refresh cadence", () => {
    const { result } = renderHook(() => useHotStocks());
    expect(result.current.refreshMs).toBe(HOT_REFRESH_MS);
  });

  it("re-polls on the interval", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useHotStocks());

    await waitFor(() => expect(result.current.stocks).toHaveLength(2));
    fetchMock.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(HOT_REFRESH_MS + 1000);
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("stops polling on unmount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result, unmount } = renderHook(() => useHotStocks());

    await waitFor(() => expect(result.current.stocks).toHaveLength(2));
    unmount();
    fetchMock.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(HOT_REFRESH_MS * 3);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("degradation", () => {
  it("shows mock movers rather than an empty sidebar when the feed is down", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useHotStocks());

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.stocks.length).toBeGreaterThan(0);
    expect(result.current.mode).toBe("poll");
  });

  it("says the feed is offline", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useHotStocks());

    await waitFor(() =>
      expect(result.current.error).toMatch(/offline/i),
    );
  });

  it("treats a non-ok response as offline", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 } as Response);
    const { result } = renderHook(() => useHotStocks());

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.stocks.length).toBeGreaterThan(0);
  });

  it("falls back to mock movers when the API returns an empty list", async () => {
    fetchMock.mockResolvedValue(payload([]));
    const { result } = renderHook(() => useHotStocks());

    await waitFor(() => expect(result.current.stocks.length).toBeGreaterThan(0));
    // The request itself succeeded, so this is not an error state.
    expect(result.current.error).toBeNull();
  });

  it("clears the error once the feed recovers", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useHotStocks());

    await waitFor(() => expect(result.current.error).not.toBeNull());
    fetchMock.mockResolvedValue(payload(live));

    await act(async () => {
      vi.advanceTimersByTime(HOT_REFRESH_MS + 1000);
    });

    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
