import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStockDetail } from "./useStockDetail";
import type { EnrichedStock } from "../types";
import type { StockDetail } from "../services/detailService";

const fetchStockDetail = vi.hoisted(() => vi.fn());

vi.mock("../services/detailService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/detailService")>()),
  fetchStockDetail,
}));

function detailFor(symbol: string, price = 100): StockDetail {
  return {
    source: "live",
    chartSource: "yahoo",
    symbol,
    company: symbol === "AAPL" ? "Apple Inc." : "Microsoft",
    tags: ["growth"],
    quote: {
      price,
      change: 1,
      changePercent: 1,
      high: price + 1,
      low: price - 1,
      open: price,
      previousClose: price,
    },
    profile: {
      exchange: "NASDAQ",
      industry: "Technology",
      logo: null,
      weburl: null,
      marketCap: 1000,
      sharesOutstanding: 10,
      ipo: null,
      country: "US",
      currency: "USD",
    },
    chart: [{ name: "5/1", price }],
  };
}

function catalogRow(over: Partial<EnrichedStock> = {}): EnrichedStock {
  return {
    id: "aapl",
    company: "Apple Inc. (AAPL)",
    symbol: "AAPL",
    price: 100,
    chartData: [],
    ...over,
  };
}

beforeEach(() => {
  fetchStockDetail.mockImplementation(async (symbol: string) =>
    detailFor(symbol),
  );
});

afterEach(() => {
  fetchStockDetail.mockReset();
});

describe("useStockDetail", () => {
  it("loads the detail for the open symbol", async () => {
    const { result } = renderHook(() => useStockDetail("AAPL", [catalogRow()]));

    await waitFor(() => expect(result.current.detail).not.toBeNull());
    expect(result.current.detail?.symbol).toBe("AAPL");
    expect(result.current.loading).toBe(false);
    expect(fetchStockDetail).toHaveBeenCalledTimes(1);
  });

  it("fetches nothing while no symbol is open", () => {
    const { result } = renderHook(() => useStockDetail(null, [catalogRow()]));

    expect(fetchStockDetail).not.toHaveBeenCalled();
    expect(result.current.detail).toBeNull();
  });

  // Regression: the live poll replaces `allStocks` every few seconds. When the
  // catalog was in the effect deps this blanked the modal and refetched, which
  // showed up as a flicker and a chart remount.
  it("does not refetch when the polled catalog changes identity", async () => {
    const { result, rerender } = renderHook(
      ({ catalog }) => useStockDetail("AAPL", catalog),
      { initialProps: { catalog: [catalogRow({ price: 100 })] } },
    );

    await waitFor(() => expect(result.current.detail).not.toBeNull());
    expect(fetchStockDetail).toHaveBeenCalledTimes(1);

    rerender({ catalog: [catalogRow({ price: 101 })] });
    rerender({ catalog: [catalogRow({ price: 102 })] });

    expect(fetchStockDetail).toHaveBeenCalledTimes(1);
    expect(result.current.detail).not.toBeNull();
  });

  it("keeps the loaded detail visible across catalog updates", async () => {
    const { result, rerender } = renderHook(
      ({ catalog }) => useStockDetail("AAPL", catalog),
      { initialProps: { catalog: [catalogRow()] } },
    );

    await waitFor(() => expect(result.current.detail).not.toBeNull());
    rerender({ catalog: [catalogRow({ price: 111 })] });

    expect(result.current.detail).not.toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("refetches when a different symbol is opened", async () => {
    const { result, rerender } = renderHook(
      ({ symbol }) => useStockDetail(symbol, [catalogRow()]),
      { initialProps: { symbol: "AAPL" } },
    );

    await waitFor(() => expect(result.current.detail?.symbol).toBe("AAPL"));

    rerender({ symbol: "MSFT" });
    await waitFor(() => expect(result.current.detail?.symbol).toBe("MSFT"));
    expect(fetchStockDetail).toHaveBeenCalledTimes(2);
  });

  it("overlays the polled price on the loaded quote", async () => {
    const { result, rerender } = renderHook(
      ({ catalog }) => useStockDetail("AAPL", catalog),
      { initialProps: { catalog: [catalogRow({ price: 100 })] } },
    );

    await waitFor(() => expect(result.current.liveQuote?.price).toBe(100));

    rerender({
      catalog: [catalogRow({ price: 250, change: 5, changePercent: 2 })],
    });

    expect(result.current.liveQuote?.price).toBe(250);
    expect(result.current.liveQuote?.changePercent).toBe(2);
    // Session figures still come from the loaded payload.
    expect(result.current.liveQuote?.open).toBe(100);
  });

  it("prices the trade stock off the live quote", async () => {
    const { result, rerender } = renderHook(
      ({ catalog }) => useStockDetail("AAPL", catalog),
      { initialProps: { catalog: [catalogRow({ price: 100 })] } },
    );

    await waitFor(() => expect(result.current.tradeStock).not.toBeNull());
    rerender({ catalog: [catalogRow({ price: 250 })] });

    expect(result.current.tradeStock?.price).toBe(250);
  });

  it("synthesises a trade stock for symbols absent from the catalog", async () => {
    const { result } = renderHook(() => useStockDetail("MSFT", []));

    await waitFor(() => expect(result.current.tradeStock).not.toBeNull());
    expect(result.current.tradeStock?.symbol).toBe("MSFT");
    expect(result.current.tradeStock?.company).toBe("Microsoft (MSFT)");
  });

  it("surfaces a load failure without leaving the spinner on", async () => {
    fetchStockDetail.mockRejectedValueOnce(new Error("upstream down"));

    const { result } = renderHook(() => useStockDetail("AAPL", []));

    await waitFor(() => expect(result.current.error).toBe("upstream down"));
    expect(result.current.loading).toBe(false);
    expect(result.current.detail).toBeNull();
  });
});
