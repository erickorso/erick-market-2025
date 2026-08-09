import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeagueProvider, useLeague } from "./LeagueContext";
import { INITIAL_FUND_AMOUNT } from "../constants";
import type { EnrichedStock, PortfolioItem } from "../types";

const fetchLeagueBoard = vi.hoisted(() => vi.fn());
const postLeagueScore = vi.hoisted(() => vi.fn());
const getAccessToken = vi.hoisted(() => vi.fn());
// vi.hoisted runs before imports, so this cannot reference a module constant;
// beforeEach resets it to INITIAL_FUND_AMOUNT.
const stock = vi.hoisted(() => ({
  fund: 10_000,
  portfolio: [] as PortfolioItem[],
  allStocks: [] as EnrichedStock[],
  isLoading: false,
}));
const user = vi.hoisted(() => ({
  isAuthenticated: true,
  displayName: "Erick",
}));

vi.mock("../services/portfolioApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/portfolioApi")>()),
  fetchLeagueBoard,
  postLeagueScore,
}));

vi.mock("./StockContext", () => ({
  useStockContext: () => ({ state: stock }),
}));

vi.mock("./UserContext", () => ({
  useUser: () => ({
    isAuthenticated: user.isAuthenticated,
    auth: { sub: "auth0|1" },
    profile: { id: "p1" },
    displayName: user.displayName,
    getAccessToken,
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LeagueProvider>{children}</LeagueProvider>
);

function board(over: Record<string, unknown> = {}) {
  return {
    mode: "shared",
    month: "2026-08",
    entries: [
      {
        playerId: "p1",
        name: "Erick",
        month: "2026-08",
        equity: 11_842,
        cash: 1_000,
        invested: 10_842,
        pnl: 1_842,
        pnlPercent: 18.4,
        updatedAt: "2026-08-08T00:00:00.000Z",
      },
    ],
    previousWinner: null,
    ...over,
  };
}

beforeEach(() => {
  fetchLeagueBoard.mockReset().mockResolvedValue(board());
  postLeagueScore.mockReset().mockResolvedValue({ ok: true });
  getAccessToken.mockReset().mockResolvedValue("tok");
  stock.fund = INITIAL_FUND_AMOUNT;
  stock.portfolio = [];
  stock.allStocks = [];
  stock.isLoading = false;
  user.isAuthenticated = true;
  user.displayName = "Erick";
});

describe("board", () => {
  it("loads the board on mount", async () => {
    const { result } = renderHook(() => useLeague(), { wrapper });

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.mode).toBe("shared");
  });

  it("falls back to local mode when the board is unreachable", async () => {
    fetchLeagueBoard.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useLeague(), { wrapper });

    await waitFor(() => expect(result.current.mode).toBe("local"));
    expect(result.current.entries).toEqual([]);
  });

  it("treats a non-shared board as ephemeral", async () => {
    fetchLeagueBoard.mockResolvedValue(board({ mode: "memory" }));
    const { result } = renderHook(() => useLeague(), { wrapper });

    await waitFor(() => expect(result.current.mode).toBe("ephemeral"));
  });

  it("scopes the board to the current month", async () => {
    const { result } = renderHook(() => useLeague(), { wrapper });

    await waitFor(() => expect(fetchLeagueBoard).toHaveBeenCalled());
    expect(fetchLeagueBoard).toHaveBeenCalledWith(result.current.month);
  });
});

describe("previous winner", () => {
  it("is null in the first month", async () => {
    const { result } = renderHook(() => useLeague(), { wrapper });

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.previousWinner).toBeNull();
  });

  it("carries the winner through", async () => {
    fetchLeagueBoard.mockResolvedValue(
      board({
        previousWinner: {
          playerId: "p2",
          name: "Marta",
          equity: 12_480,
          pnlPercent: 24.8,
        },
      }),
    );
    const { result } = renderHook(() => useLeague(), { wrapper });

    await waitFor(() => expect(result.current.previousWinner).not.toBeNull());
    expect(result.current.previousWinner?.name).toBe("Marta");
    expect(result.current.previousWinner?.equity).toBe(12_480);
  });

  // The league page renders these with .toFixed(), so a field the API omits
  // would take the whole page down.
  it("coerces missing figures to zero rather than leaving them undefined", async () => {
    fetchLeagueBoard.mockResolvedValue(
      board({ previousWinner: { playerId: "p2", name: "Marta" } }),
    );
    const { result } = renderHook(() => useLeague(), { wrapper });

    await waitFor(() => expect(result.current.previousWinner).not.toBeNull());
    expect(result.current.previousWinner?.equity).toBe(0);
    expect(result.current.previousWinner?.pnlPercent).toBe(0);
    expect(() =>
      result.current.previousWinner?.equity.toFixed(2),
    ).not.toThrow();
  });
});

describe("equity", () => {
  it("is break-even for an untouched account", async () => {
    const { result } = renderHook(() => useLeague(), { wrapper });

    expect(result.current.equity.equity).toBe(INITIAL_FUND_AMOUNT);
    expect(result.current.equity.pnl).toBe(0);
  });

  it("marks positions to the live price", async () => {
    stock.fund = 5_000;
    stock.portfolio = [
      {
        stockId: "aapl",
        company: "Apple Inc. (AAPL)",
        quantity: 10,
        purchasePrice: 100,
        totalCost: 1_000,
      },
    ];
    stock.allStocks = [
      { id: "aapl", company: "Apple Inc. (AAPL)", price: 150, chartData: [] },
    ];

    const { result } = renderHook(() => useLeague(), { wrapper });

    expect(result.current.equity.invested).toBe(1_500);
    expect(result.current.equity.equity).toBe(6_500);
  });
});

describe("player", () => {
  it("is null for a guest", () => {
    user.isAuthenticated = false;
    const { result } = renderHook(() => useLeague(), { wrapper });

    expect(result.current.player).toBeNull();
  });

  it("carries the display name when signed in", () => {
    const { result } = renderHook(() => useLeague(), { wrapper });
    expect(result.current.player?.name).toBe("Erick");
  });
});

describe("pushScore", () => {
  it("submits the computed equity", async () => {
    const { result } = renderHook(() => useLeague(), { wrapper });

    await act(async () => {
      await result.current.pushScore();
    });

    expect(postLeagueScore).toHaveBeenCalledWith(
      "tok",
      expect.objectContaining({ equity: INITIAL_FUND_AMOUNT, pnl: 0 }),
    );
  });

  it("re-reads the board so the submitter sees their new rank", async () => {
    const { result } = renderHook(() => useLeague(), { wrapper });
    await waitFor(() => expect(fetchLeagueBoard).toHaveBeenCalled());
    fetchLeagueBoard.mockClear();

    await act(async () => {
      await result.current.pushScore();
    });

    expect(fetchLeagueBoard).toHaveBeenCalled();
  });

  it("does nothing for a guest", async () => {
    user.isAuthenticated = false;
    const { result } = renderHook(() => useLeague(), { wrapper });

    await act(async () => {
      await result.current.pushScore();
    });

    expect(postLeagueScore).not.toHaveBeenCalled();
  });

  it("does nothing without a token", async () => {
    getAccessToken.mockResolvedValue(null);
    const { result } = renderHook(() => useLeague(), { wrapper });

    await act(async () => {
      await result.current.pushScore();
    });

    expect(postLeagueScore).not.toHaveBeenCalled();
  });
});

/**
 * The auto-push effect used to depend on `state.allStocks`, so every price
 * tick posted a score and re-fetched the board. A single buy produced a burst
 * of writes against a ranking nobody reads that fast.
 */
describe("automatic publishing", () => {
  function priced(price: number): EnrichedStock[] {
    return [
      {
        id: "1",
        company: "Apple (AAPL)",
        price,
        change: 0,
        tags: [],
      } as unknown as EnrichedStock,
    ];
  }

  it("publishes once after a trade", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { rerender } = renderHook(() => useLeague(), { wrapper });

    stock.portfolio = [
      { company: "Apple (AAPL)", quantity: 1 } as PortfolioItem,
    ];
    stock.fund = 9_000;
    rerender();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });

    expect(postLeagueScore).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("does not publish on a price tick", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { rerender } = renderHook(() => useLeague(), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    postLeagueScore.mockClear();

    for (const price of [190, 191, 192, 193]) {
      stock.allStocks = priced(price);
      rerender();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500);
      });
    }

    expect(postLeagueScore).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  // The board is still mark-to-market — prices move a rank with no trade
  // involved — so it republishes on a cadence rather than chasing the tick.
  it("republishes on its own interval", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderHook(() => useLeague(), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    postLeagueScore.mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(postLeagueScore).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("sends the equity current at push time, not at scheduling time", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { rerender } = renderHook(() => useLeague(), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    postLeagueScore.mockClear();

    stock.fund = 7_500;
    rerender();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(postLeagueScore).toHaveBeenCalledWith(
      "tok",
      expect.objectContaining({ cash: 7_500 }),
    );
    vi.useRealTimers();
  });

  it("publishes nothing for a guest", async () => {
    user.isAuthenticated = false;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderHook(() => useLeague(), { wrapper });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(postLeagueScore).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("guard", () => {
  it("refuses to be used outside its provider", () => {
    expect(() => renderHook(() => useLeague())).toThrow(/LeagueProvider/);
  });
});
