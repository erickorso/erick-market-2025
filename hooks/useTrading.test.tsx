import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTrading } from "./useTrading";
import { initialState } from "../context/stockReducer";
import { INITIAL_FUND_AMOUNT } from "../constants";
import { ApiError } from "../services/portfolioApi";
import type { EnrichedStock, StockContextState } from "../types";

const postTrade = vi.hoisted(() => vi.fn());
const refreshProfile = vi.hoisted(() => vi.fn());
const getAccessToken = vi.hoisted(() => vi.fn());
const login = vi.hoisted(() => vi.fn());
const user = vi.hoisted(() => ({
  isAuthenticated: true,
  isLoading: false,
  portfolio: null as unknown,
}));

vi.mock("../services/portfolioApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/portfolioApi")>()),
  postTrade,
}));

vi.mock("../context/UserContext", () => ({
  useUser: () => ({
    isAuthenticated: user.isAuthenticated,
    isLoading: user.isLoading,
    portfolio: user.portfolio,
    getAccessToken,
    refreshProfile,
    login,
  }),
}));

function state(over: Partial<StockContextState> = {}): StockContextState {
  return { ...initialState, ...over };
}

function stock(over: Partial<EnrichedStock> = {}): EnrichedStock {
  return {
    id: "aapl",
    company: "Apple Inc. (AAPL)",
    symbol: "AAPL",
    price: 190,
    chartData: [],
    ...over,
  };
}

const serverPortfolio = {
  month: "2026-08",
  cash: 5_000,
  positions: [{ symbol: "AAPL", company: "Apple Inc.", qty: 2, avg_cost: 190 }],
};

beforeEach(() => {
  postTrade.mockReset().mockResolvedValue(serverPortfolio);
  refreshProfile.mockReset().mockResolvedValue(undefined);
  getAccessToken.mockReset().mockResolvedValue("tok");
  login.mockReset();
  user.isAuthenticated = true;
  user.isLoading = false;
  user.portfolio = null;
});

describe("portfolio hydration", () => {
  it("waits while the session is still resolving", () => {
    user.isLoading = true;
    const dispatch = vi.fn();
    renderHook(() => useTrading(state(), dispatch));

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("resets a guest to the opening fund with nothing held", () => {
    user.isAuthenticated = false;
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTrading(state(), dispatch));

    expect(dispatch).toHaveBeenCalledWith({
      type: "HYDRATE_PORTFOLIO",
      payload: { portfolio: [], fund: INITIAL_FUND_AMOUNT },
    });
    expect(result.current.portfolioSynced).toBe(false);
  });

  it("takes the server portfolio as the source of truth", async () => {
    user.portfolio = serverPortfolio;
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTrading(state(), dispatch));

    await waitFor(() => expect(result.current.portfolioSynced).toBe(true));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "HYDRATE_PORTFOLIO",
        payload: expect.objectContaining({ fund: 5_000 }),
      }),
    );
  });

  it("holds off until the server portfolio actually arrives", () => {
    user.portfolio = null;
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTrading(state(), dispatch));

    expect(result.current.portfolioSynced).toBe(false);
  });
});

describe("buyStock", () => {
  it("posts the trade and re-hydrates from the response", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTrading(state(), dispatch));

    await act(async () => {
      await result.current.buyStock(stock(), 2);
    });

    expect(postTrade).toHaveBeenCalledWith("tok", {
      side: "buy",
      symbol: "AAPL",
      company: "Apple Inc. (AAPL)",
      qty: 2,
      price: 190,
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "HYDRATE_PORTFOLIO" }),
    );
  });

  it("refreshes the profile so the league score follows the trade", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTrading(state(), dispatch));

    await act(async () => {
      await result.current.buyStock(stock(), 1);
    });

    expect(refreshProfile).toHaveBeenCalledTimes(1);
  });

  it("confirms the trade to the user", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTrading(state(), dispatch));

    await act(async () => {
      await result.current.buyStock(stock(), 3);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_NOTICE",
      payload: {
        type: "success",
        message: "Bought 3 share(s) of Apple Inc. (AAPL).",
      },
    });
  });

  it("derives the ticker when the row carries none", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTrading(state(), dispatch));

    await act(async () => {
      await result.current.buyStock(stock({ symbol: undefined }), 1);
    });

    expect(postTrade.mock.calls[0][1].symbol).toBe("AAPL");
  });

  it("asks a guest to sign in instead of posting", async () => {
    user.isAuthenticated = false;
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTrading(state(), dispatch));

    await act(async () => {
      await result.current.buyStock(stock(), 1);
    });

    expect(postTrade).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_NOTICE",
      payload: { type: "info", message: "Sign in to trade." },
    });
  });

  it("sends the user to sign in when there is no usable token", async () => {
    getAccessToken.mockResolvedValue(null);
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTrading(state(), dispatch));

    await act(async () => {
      await result.current.buyStock(stock(), 1);
    });

    expect(postTrade).not.toHaveBeenCalled();
    expect(login).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_NOTICE",
      payload: expect.objectContaining({ type: "info" }),
    });
  });

  // The common case after an idle hour: the cached token is stale but the
  // Auth0 session is alive, so the trade should still go through.
  it("renews a stale token and retries once", async () => {
    postTrade
      .mockRejectedValueOnce(
        new ApiError("Authentication failed", 401, "token_expired"),
      )
      .mockResolvedValue(serverPortfolio);
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTrading(state(), dispatch));

    await act(async () => {
      await result.current.buyStock(stock(), 1);
    });

    expect(getAccessToken).toHaveBeenLastCalledWith({ forceRefresh: true });
    expect(postTrade).toHaveBeenCalledTimes(2);
    expect(login).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SET_NOTICE",
        payload: expect.objectContaining({ type: "success" }),
      }),
    );
  });

  it("sends the user to sign in when the renewal also fails", async () => {
    postTrade.mockRejectedValue(
      new ApiError("Authentication failed", 401, "token_expired"),
    );
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTrading(state(), dispatch));

    await act(async () => {
      await result.current.buyStock(stock(), 1);
    });

    expect(login).toHaveBeenCalledTimes(1);
    // Never the API's wording — the user gets told the session ended.
    const notices = dispatch.mock.calls
      .map(([a]) => a)
      .filter((a) => a.type === "SET_NOTICE");
    expect(
      notices.some((n) => /Authentication failed/.test(n.payload.message)),
    ).toBe(false);
  });

  it("still reports a genuine trade rejection as an error", async () => {
    postTrade.mockRejectedValue(
      new ApiError("Insufficient funds", 400, undefined),
    );
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTrading(state(), dispatch));

    await act(async () => {
      await result.current.buyStock(stock(), 1);
    });

    expect(login).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_NOTICE",
      payload: { type: "error", message: "Insufficient funds" },
    });
  });

  it("surfaces the API's rejection reason", async () => {
    postTrade.mockRejectedValue(new Error("insufficient funds"));
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTrading(state(), dispatch));

    await act(async () => {
      await result.current.buyStock(stock(), 1);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_NOTICE",
      payload: { type: "error", message: "insufficient funds" },
    });
  });

  it("does not hydrate from a failed trade", async () => {
    postTrade.mockRejectedValue(new Error("nope"));
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTrading(state(), dispatch));
    dispatch.mockClear();

    await act(async () => {
      await result.current.buyStock(stock(), 1);
    });

    expect(
      dispatch.mock.calls.some(([a]) => a.type === "HYDRATE_PORTFOLIO"),
    ).toBe(false);
  });
});

describe("sellStock", () => {
  it("posts the sell side with the held ticker", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useTrading(
        state({
          portfolio: [
            {
              stockId: "aapl",
              symbol: "AAPL",
              company: "Apple Inc. (AAPL)",
              quantity: 5,
              purchasePrice: 100,
              totalCost: 500,
            },
          ],
        }),
        dispatch,
      ),
    );

    await act(async () => {
      await result.current.sellStock("Apple Inc. (AAPL)", 2, 195);
    });

    expect(postTrade).toHaveBeenCalledWith("tok", {
      side: "sell",
      symbol: "AAPL",
      company: "Apple Inc. (AAPL)",
      qty: 2,
      price: 195,
    });
  });

  it("falls back to the ticker in the company label", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTrading(state(), dispatch));

    await act(async () => {
      await result.current.sellStock("Tesla Inc. (TSLA)", 1, 250);
    });

    expect(postTrade.mock.calls[0][1].symbol).toBe("TSLA");
  });

  it("confirms the sale", async () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTrading(state(), dispatch));

    await act(async () => {
      await result.current.sellStock("Apple Inc. (AAPL)", 2, 195);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_NOTICE",
      payload: {
        type: "success",
        message: "Sold 2 share(s) of Apple Inc. (AAPL).",
      },
    });
  });

  it("asks a guest to sign in", async () => {
    user.isAuthenticated = false;
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTrading(state(), dispatch));

    await act(async () => {
      await result.current.sellStock("Apple Inc. (AAPL)", 1, 1);
    });

    expect(postTrade).not.toHaveBeenCalled();
  });
});
