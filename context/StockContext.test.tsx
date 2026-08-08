import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StockProvider, useStockContext } from "./StockContext";

const loadStocks = vi.hoisted(() => vi.fn());
const loadMore = vi.hoisted(() => vi.fn());
const buyStock = vi.hoisted(() => vi.fn());
const sellStock = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useStockCatalog", () => ({
  useStockCatalog: () => ({ loadStocks, loadMore }),
}));

vi.mock("../hooks/useTrading", () => ({
  useTrading: () => ({ buyStock, sellStock, portfolioSynced: true }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <StockProvider>{children}</StockProvider>
);

beforeEach(() => {
  loadStocks.mockReset().mockResolvedValue(undefined);
  loadMore.mockReset().mockResolvedValue(undefined);
  window.history.replaceState({}, "", "/");
});

describe("StockProvider", () => {
  it("exposes the reducer state", () => {
    const { result } = renderHook(() => useStockContext(), { wrapper });

    expect(result.current.state.allStocks).toEqual([]);
    expect(result.current.state.category).toBe("all");
  });

  it("seeds the filters from the URL", () => {
    window.history.replaceState({}, "", "/?q=AAPL&category=growth");
    const { result } = renderHook(() => useStockContext(), { wrapper });

    expect(result.current.state.searchTerm).toBe("AAPL");
    expect(result.current.state.category).toBe("growth");
  });

  it("dispatches through the reducer", () => {
    const { result } = renderHook(() => useStockContext(), { wrapper });

    act(() => result.current.dispatch({ type: "OPEN_DETAIL", payload: "aapl" }));
    expect(result.current.state.detailSymbol).toBe("AAPL");
  });

  it("mirrors filter changes back into the URL", async () => {
    const { result } = renderHook(() => useStockContext(), { wrapper });

    act(() =>
      result.current.dispatch({ type: "SET_CATEGORY", payload: "dividend" }),
    );

    await waitFor(() =>
      expect(window.location.search).toContain("category=dividend"),
    );
  });

  it("delegates fetching to the catalog hook", async () => {
    const { result } = renderHook(() => useStockContext(), { wrapper });

    await act(async () => {
      await result.current.fetchStocks();
    });

    expect(loadStocks).toHaveBeenCalled();
  });

  it("delegates paging and trading", async () => {
    const { result } = renderHook(() => useStockContext(), { wrapper });

    await act(async () => {
      await result.current.loadMore();
    });

    expect(loadMore).toHaveBeenCalled();
    expect(result.current.buyStock).toBe(buyStock);
    expect(result.current.sellStock).toBe(sellStock);
    expect(result.current.portfolioSynced).toBe(true);
  });

  it("auto-dismisses a notice", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useStockContext(), { wrapper });

    act(() =>
      result.current.dispatch({
        type: "SET_NOTICE",
        payload: { type: "success", message: "Bought" },
      }),
    );
    expect(result.current.state.notice).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    expect(result.current.state.notice).toBeNull();
    vi.useRealTimers();
  });

  it("refuses to be used outside its provider", () => {
    expect(() => renderHook(() => useStockContext())).toThrow(/StockProvider/);
  });
});
