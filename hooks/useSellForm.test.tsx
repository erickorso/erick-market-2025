import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSellForm } from "./useSellForm";
import { I18nProvider } from "../context/I18nContext";
import type { EnrichedStock, PortfolioItem } from "../types";

const sellStock = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => ({
  portfolio: [] as PortfolioItem[],
  allStocks: [] as EnrichedStock[],
}));

vi.mock("../context/StockContext", () => ({
  useStockContext: () => ({
    state: { portfolio: store.portfolio, allStocks: store.allStocks },
    sellStock,
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
);

function held(over: Partial<PortfolioItem> = {}): PortfolioItem {
  return {
    stockId: "aapl",
    company: "Apple Inc. (AAPL)",
    quantity: 10,
    purchasePrice: 100,
    totalCost: 1000,
    ...over,
  };
}

beforeEach(() => {
  sellStock.mockReset().mockResolvedValue(undefined);
  store.portfolio = [held()];
  store.allStocks = [
    { id: "aapl", company: "Apple Inc. (AAPL)", price: 150, chartData: [] },
  ];
});

describe("resolution", () => {
  it("decodes the company from the route parameter", () => {
    const { result } = renderHook(() => useSellForm("Apple%20Inc.%20(AAPL)"), {
      wrapper,
    });

    expect(result.current.company).toBe("Apple Inc. (AAPL)");
    expect(result.current.found).toBe(true);
  });

  it("reports not found when the position is gone", () => {
    store.portfolio = [];
    const { result } = renderHook(() => useSellForm("Apple%20Inc.%20(AAPL)"), {
      wrapper,
    });

    expect(result.current.found).toBe(false);
  });

  it("reports not found when the symbol is no longer quoted", () => {
    store.allStocks = [];
    const { result } = renderHook(() => useSellForm("Apple%20Inc.%20(AAPL)"), {
      wrapper,
    });

    expect(result.current.found).toBe(false);
  });

  it("handles a missing route parameter", () => {
    const { result } = renderHook(() => useSellForm(undefined), { wrapper });

    expect(result.current.company).toBe("");
    expect(result.current.found).toBe(false);
  });

  it("exposes the held quantity and the live price", () => {
    const { result } = renderHook(() => useSellForm("Apple%20Inc.%20(AAPL)"), {
      wrapper,
    });

    expect(result.current.maxQuantity).toBe(10);
    expect(result.current.currentPrice).toBe(150);
  });

  it("values the sale at the live price", () => {
    const { result } = renderHook(() => useSellForm("Apple%20Inc.%20(AAPL)"), {
      wrapper,
    });

    act(() => result.current.setQuantity(4));
    expect(result.current.totalValue).toBe(600);
  });
});

describe("submit", () => {
  it("sells and reports success", async () => {
    const { result } = renderHook(() => useSellForm("Apple%20Inc.%20(AAPL)"), {
      wrapper,
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.submit();
    });

    expect(ok).toBe(true);
    expect(sellStock).toHaveBeenCalledWith("Apple Inc. (AAPL)", 1);
  });

  it("refuses a non-positive quantity", async () => {
    const { result } = renderHook(() => useSellForm("Apple%20Inc.%20(AAPL)"), {
      wrapper,
    });

    act(() => result.current.setQuantity(0));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.submit();
    });

    expect(ok).toBe(false);
    expect(sellStock).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/greater than zero/i);
  });

  it("refuses to sell more than is held", async () => {
    const { result } = renderHook(() => useSellForm("Apple%20Inc.%20(AAPL)"), {
      wrapper,
    });

    act(() => result.current.setQuantity(11));
    await act(async () => {
      await result.current.submit();
    });

    expect(sellStock).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/only sell up to 10/i);
  });

  it("allows selling the whole position", async () => {
    const { result } = renderHook(() => useSellForm("Apple%20Inc.%20(AAPL)"), {
      wrapper,
    });

    act(() => result.current.setQuantity(10));
    await act(async () => {
      await result.current.submit();
    });

    expect(sellStock).toHaveBeenCalledWith("Apple Inc. (AAPL)", 10);
  });

  it("surfaces a rejected trade and stays on the form", async () => {
    sellStock.mockRejectedValue(new Error("market closed"));
    const { result } = renderHook(() => useSellForm("Apple%20Inc.%20(AAPL)"), {
      wrapper,
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.submit();
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe("market closed");
  });

  it("clears a previous error on the next attempt", async () => {
    const { result } = renderHook(() => useSellForm("Apple%20Inc.%20(AAPL)"), {
      wrapper,
    });

    act(() => result.current.setQuantity(99));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.error).not.toBe("");

    act(() => result.current.setQuantity(1));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.error).toBe("");
  });

  it("clears busy once the trade settles", async () => {
    const { result } = renderHook(() => useSellForm("Apple%20Inc.%20(AAPL)"), {
      wrapper,
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.busy).toBe(false);
  });
});

// The button's `disabled` only applies on the next render, so it cannot stop
// two clicks landing in the same tick. Selling twice is real money here.
describe("double submit", () => {
  it("refuses a second submit while one is in flight", async () => {
    let release: (v: unknown) => void = () => {};
    sellStock.mockReturnValue(new Promise((r) => (release = r)));
    const { result } = renderHook(() => useSellForm("Apple Inc. (AAPL)"), {
      wrapper,
    });

    act(() => {
      result.current.setQuantity(1);
    });

    let second!: Promise<boolean>;
    await act(async () => {
      void result.current.submit();
      second = result.current.submit();
      release(undefined);
    });

    expect(await second).toBe(false);
    expect(sellStock).toHaveBeenCalledTimes(1);
  });
});
