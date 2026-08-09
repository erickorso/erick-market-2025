import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptyPortfolioState,
  fetchLeagueBoard,
  fetchMe,
  fetchPortfolio,
  portfolioToState,
  postLeagueScore,
  postTrade,
  type ApiPortfolio,
} from "./portfolioApi";
import { INITIAL_FUND_AMOUNT } from "../constants";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function ok(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

function fail(status: number, body: unknown = {}) {
  return { ok: false, status, json: async () => body } as Response;
}

function apiPortfolio(over: Partial<ApiPortfolio> = {}): ApiPortfolio {
  return {
    month: "2026-08",
    cash: 7_856.4,
    positions: [
      { symbol: "AAPL", company: "Apple Inc.", qty: 10, avg_cost: 208.6 },
    ],
    ...over,
  };
}

describe("portfolioToState", () => {
  it("maps cash to the local fund", () => {
    expect(portfolioToState(apiPortfolio()).fund).toBe(7_856.4);
  });

  it("derives the local id from the ticker", () => {
    expect(portfolioToState(apiPortfolio()).portfolio[0].stockId).toBe("aapl");
  });

  it("appends the ticker to a bare company name", () => {
    expect(portfolioToState(apiPortfolio()).portfolio[0].company).toBe(
      "Apple Inc. (AAPL)",
    );
  });

  it("leaves a company that already carries its ticker alone", () => {
    const mapped = portfolioToState(
      apiPortfolio({
        positions: [
          { symbol: "AAPL", company: "Apple Inc. (AAPL)", qty: 1, avg_cost: 1 },
        ],
      }),
    );

    expect(mapped.portfolio[0].company).toBe("Apple Inc. (AAPL)");
  });

  it("recomputes total cost from quantity and average", () => {
    expect(portfolioToState(apiPortfolio()).portfolio[0].totalCost).toBe(2086);
  });

  it("handles an empty portfolio", () => {
    const mapped = portfolioToState(apiPortfolio({ positions: [], cash: 10 }));

    expect(mapped.portfolio).toEqual([]);
    expect(mapped.fund).toBe(10);
  });
});

describe("authenticated requests", () => {
  it("sends the bearer token", async () => {
    fetchMock.mockResolvedValue(ok({ user: {}, portfolio: apiPortfolio() }));
    await fetchMe("tok123");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer tok123" }),
      }),
    );
  });

  it("posts a trade as JSON", async () => {
    fetchMock.mockResolvedValue(ok(apiPortfolio()));
    await postTrade("tok", {
      side: "buy",
      symbol: "AAPL",
      company: "Apple Inc.",
      qty: 2,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/trade");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ side: "buy", qty: 2 });
  });

  it("returns the portfolio the trade produced", async () => {
    fetchMock.mockResolvedValue(ok(apiPortfolio({ cash: 1 })));
    const result = await postTrade("tok", {
      side: "sell",
      symbol: "AAPL",
      company: "Apple",
      qty: 1,
    });

    expect(result.cash).toBe(1);
  });

  it("posts a league score", async () => {
    fetchMock.mockResolvedValue(ok({ ok: true }));
    await postLeagueScore("tok", {
      equity: 1,
      cash: 1,
      invested: 0,
      pnl: 0,
      pnlPercent: 0,
    });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/league");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });
});

describe("error handling", () => {
  it("surfaces the API's own message", async () => {
    fetchMock.mockResolvedValue(fail(400, { error: "insufficient funds" }));

    await expect(
      postTrade("tok", {
        side: "buy",
        symbol: "AAPL",
        company: "Apple",
        qty: 1,
      }),
    ).rejects.toThrow("insufficient funds");
  });

  it("falls back to the status when there is no message", async () => {
    fetchMock.mockResolvedValue(fail(503, {}));
    await expect(fetchPortfolio("tok")).rejects.toThrow("portfolio 503");
  });

  it("survives an error body that is not JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);

    await expect(fetchMe("tok")).rejects.toThrow("me 500");
  });
});

describe("fetchLeagueBoard", () => {
  it("is public — it sends no token", async () => {
    fetchMock.mockResolvedValue(ok({ entries: [] }));
    await fetchLeagueBoard();

    expect(fetchMock).toHaveBeenCalledWith("/api/league");
  });

  it("scopes the board to a month when asked", async () => {
    fetchMock.mockResolvedValue(ok({ entries: [] }));
    await fetchLeagueBoard("2026-08");

    expect(fetchMock).toHaveBeenCalledWith("/api/league?month=2026-08");
  });

  it("throws on a failed board", async () => {
    fetchMock.mockResolvedValue(fail(500, {}));
    await expect(fetchLeagueBoard("2026-08")).rejects.toThrow("league 500");
  });
});

describe("emptyPortfolioState", () => {
  it("starts a guest at the opening fund with nothing held", () => {
    expect(emptyPortfolioState).toEqual({
      portfolio: [],
      fund: INITIAL_FUND_AMOUNT,
    });
  });
});
