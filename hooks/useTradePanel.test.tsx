import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTradePanel } from "./useTradePanel";
import type { EnrichedStock } from "../types";

const requestLogin = vi.hoisted(() => vi.fn());
const buyStock = vi.hoisted(() => vi.fn());
const login = vi.hoisted(() => vi.fn());
const contextState = vi.hoisted(() => ({
  fund: 10_000,
  isAuthenticated: true,
}));

vi.mock("../context/StockContext", () => ({
  useStockContext: () => ({
    buyStock,
    state: { fund: contextState.fund },
  }),
}));

vi.mock("../context/AuthPromptContext", () => ({
  useAuthPrompt: () => ({ requestLogin, reason: null }),
}));

vi.mock("../context/UserContext", () => ({
  useUser: () => ({ isAuthenticated: contextState.isAuthenticated, login }),
}));

function stock(over: Partial<EnrichedStock> = {}): EnrichedStock {
  return {
    id: "aapl",
    company: "Apple (AAPL)",
    price: 100,
    chartData: [],
    ...over,
  };
}

beforeEach(() => {
  buyStock.mockReset().mockResolvedValue(undefined);
  login.mockReset();
  requestLogin.mockReset();
  contextState.fund = 10_000;
  contextState.isAuthenticated = true;
});

describe("quantity", () => {
  it("starts at one", () => {
    const { result } = renderHook(() => useTradePanel(stock()));
    expect(result.current.quantity).toBe(1);
  });

  it("increments without an upper bound", () => {
    const { result } = renderHook(() => useTradePanel(stock()));

    act(() => result.current.increment());
    act(() => result.current.increment());

    expect(result.current.quantity).toBe(3);
  });

  it("clamps decrement at one", () => {
    const { result } = renderHook(() => useTradePanel(stock()));

    act(() => result.current.decrement());
    act(() => result.current.decrement());

    expect(result.current.quantity).toBe(1);
  });

  it("resets when the resetKey changes", () => {
    const { result, rerender } = renderHook(
      ({ key }) => useTradePanel(stock(), { resetKey: key }),
      { initialProps: { key: "AAPL" } },
    );

    act(() => result.current.increment());
    expect(result.current.quantity).toBe(2);

    rerender({ key: "MSFT" });
    expect(result.current.quantity).toBe(1);
  });
});

describe("totals and affordability", () => {
  it("multiplies price by quantity", () => {
    const { result } = renderHook(() => useTradePanel(stock({ price: 250 })));

    act(() => result.current.increment());
    expect(result.current.totalPrice).toBe(500);
  });

  it("is zero with no stock selected", () => {
    const { result } = renderHook(() => useTradePanel(null));
    expect(result.current.totalPrice).toBe(0);
  });

  it("flags a total the fund cannot cover", () => {
    contextState.fund = 150;
    const { result } = renderHook(() => useTradePanel(stock({ price: 100 })));

    expect(result.current.canAfford).toBe(true);
    act(() => result.current.increment());
    expect(result.current.canAfford).toBe(false);
    expect(result.current.disabled).toBe(true);
  });
});

describe("submit", () => {
  it("buys the selected quantity", async () => {
    const { result } = renderHook(() => useTradePanel(stock()));

    act(() => result.current.increment());
    await act(async () => {
      await result.current.submit();
    });

    expect(buyStock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "aapl" }),
      2,
    );
  });

  it("routes guests to login instead of buying", async () => {
    contextState.isAuthenticated = false;
    const { result } = renderHook(() => useTradePanel(stock()));

    expect(result.current.locked).toBe(true);
    // Guests keep a live button so the CTA is discoverable.
    expect(result.current.disabled).toBe(false);

    await act(async () => {
      await result.current.submit();
    });

    expect(requestLogin).toHaveBeenCalledWith("trade");
    expect(login).not.toHaveBeenCalled();
    expect(buyStock).not.toHaveBeenCalled();
  });

  it("refuses to buy what the fund cannot cover", async () => {
    contextState.fund = 10;
    const { result } = renderHook(() => useTradePanel(stock({ price: 100 })));

    await act(async () => {
      await result.current.submit();
    });

    expect(buyStock).not.toHaveBeenCalled();
  });

  it("does nothing without a stock", async () => {
    const { result } = renderHook(() => useTradePanel(null));

    await act(async () => {
      await result.current.submit();
    });

    expect(buyStock).not.toHaveBeenCalled();
  });

  it("clears busy once the trade settles", async () => {
    const { result } = renderHook(() => useTradePanel(stock()));

    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(buyStock).toHaveBeenCalledTimes(1);
  });

  it("clears busy even when the trade rejects", async () => {
    buyStock.mockRejectedValueOnce(new Error("api down"));
    const { result } = renderHook(() => useTradePanel(stock()));

    await act(async () => {
      await result.current.submit().catch(() => {});
    });

    await waitFor(() => expect(result.current.busy).toBe(false));
  });
});

// The buy guard used to read `busy` from the closure, which two clicks in the
// same tick both see as false. Buying twice is real money here.
describe("double submit", () => {
  it("refuses a second buy while one is in flight", async () => {
    let release: (v: unknown) => void = () => {};
    buyStock.mockReturnValue(new Promise((r) => (release = r)));
    const { result } = renderHook(() => useTradePanel(stock()));

    await act(async () => {
      void result.current.submit();
      void result.current.submit();
      release(undefined);
    });

    expect(buyStock).toHaveBeenCalledTimes(1);
  });
});
