import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStockCatalog } from "./useStockCatalog";
import { initialState } from "../context/stockReducer";
import type { EnrichedStock, StockContextState } from "../types";

const fetchStocks = vi.hoisted(() => vi.fn());

vi.mock("../services/stockService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/stockService")>()),
  fetchStocks,
}));

function stock(id: string, price = 100): EnrichedStock {
  return { id, company: `Co ${id}`, price, chartData: [] };
}

function state(over: Partial<StockContextState> = {}): StockContextState {
  return { ...initialState, ...over };
}

function result(over: Record<string, unknown> = {}) {
  return {
    stocks: [stock("a"), stock("b")],
    source: "live" as const,
    hasMore: true,
    total: 40,
    ...over,
  };
}

beforeEach(() => {
  // shouldAdvanceTime keeps real time moving, otherwise Testing Library's
  // waitFor — which polls on real timers — would never resolve.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchStocks.mockReset().mockResolvedValue(result());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("initial load", () => {
  it("fetches once on mount", async () => {
    const dispatch = vi.fn();
    renderHook(() => useStockCatalog(state(), dispatch));

    await waitFor(() => expect(fetchStocks).toHaveBeenCalledTimes(1));
  });

  it("does not refetch on an unrelated re-render", async () => {
    const dispatch = vi.fn();
    const { rerender } = renderHook(({ s }) => useStockCatalog(s, dispatch), {
      initialProps: { s: state() },
    });

    await waitFor(() => expect(fetchStocks).toHaveBeenCalledTimes(1));
    rerender({ s: state({ notice: { type: "info", message: "hi" } }) });
    rerender({ s: state({ isLoadingMore: true }) });

    expect(fetchStocks).toHaveBeenCalledTimes(1);
  });

  it("publishes the page and the data source", async () => {
    const dispatch = vi.fn();
    renderHook(() => useStockCatalog(state(), dispatch));

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SET_STOCKS",
          source: "live",
          hasMore: true,
          total: 40,
        }),
      ),
    );
  });

  it("warns through a notice when the data is mocked", async () => {
    fetchStocks.mockResolvedValue(result({ source: "mock" }));
    const dispatch = vi.fn();
    renderHook(() => useStockCatalog(state(), dispatch));

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SET_NOTICE",
          payload: expect.objectContaining({ type: "info" }),
        }),
      ),
    );
  });

  it("surfaces a failed load as an error", async () => {
    fetchStocks.mockRejectedValue(new Error("upstream down"));
    const dispatch = vi.fn();
    renderHook(() => useStockCatalog(state(), dispatch));

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({
        type: "SET_ERROR",
        payload: "upstream down",
      }),
    );
  });
});

describe("loadMore", () => {
  it("requests the next page from the current offset", async () => {
    const dispatch = vi.fn();
    const { result: hook } = renderHook(() =>
      useStockCatalog(state({ allStocks: [stock("a"), stock("b")] }), dispatch),
    );

    await waitFor(() => expect(fetchStocks).toHaveBeenCalledTimes(1));
    fetchStocks.mockClear();

    await act(async () => {
      await hook.current.loadMore();
    });

    expect(fetchStocks).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 2 }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "APPEND_STOCKS" }),
    );
  });

  it("does nothing when the catalog is still empty", async () => {
    const dispatch = vi.fn();
    const { result: hook } = renderHook(() =>
      useStockCatalog(state(), dispatch),
    );

    await waitFor(() => expect(fetchStocks).toHaveBeenCalledTimes(1));
    fetchStocks.mockClear();

    await act(async () => {
      await hook.current.loadMore();
    });

    expect(fetchStocks).not.toHaveBeenCalled();
  });

  it("clears the paging spinner when the request fails", async () => {
    const dispatch = vi.fn();
    const { result: hook } = renderHook(() =>
      useStockCatalog(state({ allStocks: [stock("a")] }), dispatch),
    );

    await waitFor(() => expect(fetchStocks).toHaveBeenCalledTimes(1));
    fetchStocks.mockRejectedValueOnce(new Error("nope"));

    await act(async () => {
      await hook.current.loadMore();
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_LOADING_MORE",
      payload: false,
    });
  });
});

describe("search", () => {
  it("does not refetch on the first render", async () => {
    const dispatch = vi.fn();
    renderHook(() => useStockCatalog(state({ searchTerm: "AAPL" }), dispatch));

    await waitFor(() => expect(fetchStocks).toHaveBeenCalledTimes(1));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(fetchStocks).toHaveBeenCalledTimes(1);
  });

  it("debounces typing into a single request", async () => {
    const dispatch = vi.fn();
    const { rerender } = renderHook(({ s }) => useStockCatalog(s, dispatch), {
      initialProps: { s: state() },
    });

    await waitFor(() => expect(fetchStocks).toHaveBeenCalledTimes(1));
    fetchStocks.mockClear();

    rerender({ s: state({ searchTerm: "A" }) });
    rerender({ s: state({ searchTerm: "AA" }) });
    rerender({ s: state({ searchTerm: "AAP" }) });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(fetchStocks).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(fetchStocks).toHaveBeenCalledTimes(1);
    expect(fetchStocks).toHaveBeenCalledWith(
      expect.objectContaining({ q: "AAP" }),
    );
  });
});

describe("category", () => {
  it("refetches immediately, without the search debounce", async () => {
    const dispatch = vi.fn();
    const { rerender } = renderHook(({ s }) => useStockCatalog(s, dispatch), {
      initialProps: { s: state() },
    });

    await waitFor(() => expect(fetchStocks).toHaveBeenCalledTimes(1));
    fetchStocks.mockClear();

    rerender({ s: state({ category: "growth" }) });

    await waitFor(() =>
      expect(fetchStocks).toHaveBeenCalledWith(
        expect.objectContaining({ category: "growth" }),
      ),
    );
  });
});

describe("refresh loops", () => {
  it("ticks prices locally when the data is mocked", async () => {
    const dispatch = vi.fn();
    renderHook(() =>
      useStockCatalog(
        state({
          isLoading: false,
          dataSource: "mock",
          allStocks: [stock("a")],
        }),
        dispatch,
      ),
    );

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(
      dispatch.mock.calls.filter(([a]) => a.type === "TICK_PRICES").length,
    ).toBeGreaterThan(0);
  });

  it("never ticks locally while live", async () => {
    const dispatch = vi.fn();
    renderHook(() =>
      useStockCatalog(
        state({
          isLoading: false,
          dataSource: "live",
          allStocks: [stock("a")],
        }),
        dispatch,
      ),
    );

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(dispatch.mock.calls.some(([a]) => a.type === "TICK_PRICES")).toBe(
      false,
    );
  });

  it("polls silently while live, merging instead of reloading", async () => {
    const dispatch = vi.fn();
    renderHook(() =>
      useStockCatalog(
        state({
          isLoading: false,
          dataSource: "live",
          allStocks: [stock("a")],
        }),
        dispatch,
      ),
    );

    await waitFor(() => expect(fetchStocks).toHaveBeenCalled());
    dispatch.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });

    await waitFor(() =>
      expect(dispatch.mock.calls.some(([a]) => a.type === "MERGE_STOCKS")).toBe(
        true,
      ),
    );
    // A silent poll must never flip the page back into its loading state.
    expect(
      dispatch.mock.calls.some(
        ([a]) => a.type === "SET_LOADING" && a.payload === true,
      ),
    ).toBe(false);
  });

  it("stops every loop on unmount", async () => {
    const dispatch = vi.fn();
    const { unmount } = renderHook(() =>
      useStockCatalog(
        state({
          isLoading: false,
          dataSource: "mock",
          allStocks: [stock("a")],
        }),
        dispatch,
      ),
    );

    // Let the mount fetch settle first, so we only assert on the timers.
    await waitFor(() => expect(fetchStocks).toHaveBeenCalled());
    unmount();
    dispatch.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(300_000);
    });

    expect(dispatch).not.toHaveBeenCalled();
  });
});
