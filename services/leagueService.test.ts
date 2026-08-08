import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPlayer,
  computeEquity,
  currentMonthKey,
  getLocalBoard,
  loadPlayer,
  newPlayerId,
  portfolioMarketValue,
  previousMonthKey,
  savePlayer,
  upsertLocalScore,
} from "./leagueService";
import { INITIAL_FUND_AMOUNT } from "../constants";
import type { EnrichedStock, PortfolioItem } from "../types";

function position(over: Partial<PortfolioItem> = {}): PortfolioItem {
  return {
    stockId: "aapl",
    company: "Apple (AAPL)",
    quantity: 10,
    purchasePrice: 100,
    totalCost: 1000,
    ...over,
  };
}

function stock(over: Partial<EnrichedStock> = {}): EnrichedStock {
  return {
    id: "aapl",
    company: "Apple (AAPL)",
    price: 100,
    chartData: [],
    ...over,
  };
}

describe("month keys", () => {
  it("formats as YYYY-MM with a padded month", () => {
    expect(currentMonthKey(new Date(2026, 2, 15))).toBe("2026-03");
  });

  it("steps back one month", () => {
    expect(previousMonthKey(new Date(2026, 2, 15))).toBe("2026-02");
  });

  it("rolls the year back across January", () => {
    expect(previousMonthKey(new Date(2026, 0, 5))).toBe("2025-12");
  });
});

describe("portfolioMarketValue", () => {
  it("marks positions to the live price", () => {
    expect(
      portfolioMarketValue([position({ quantity: 10 })], [stock({ price: 150 })]),
    ).toBe(1500);
  });

  it("matches by company when the id differs", () => {
    expect(
      portfolioMarketValue(
        [position({ stockId: "other" })],
        [stock({ id: "different", price: 200 })],
      ),
    ).toBe(2000);
  });

  it("falls back to the cost basis for unquoted positions", () => {
    expect(
      portfolioMarketValue([position({ purchasePrice: 100 })], []),
    ).toBe(1000);
  });

  it("is zero for an empty portfolio", () => {
    expect(portfolioMarketValue([], [stock()])).toBe(0);
  });
});

describe("computeEquity", () => {
  it("reports break-even for an untouched account", () => {
    const result = computeEquity(INITIAL_FUND_AMOUNT, [], []);

    expect(result.equity).toBe(INITIAL_FUND_AMOUNT);
    expect(result.pnl).toBe(0);
    expect(result.pnlPercent).toBe(0);
  });

  it("adds cash to the marked-to-market positions", () => {
    const result = computeEquity(
      5_000,
      [position({ quantity: 10 })],
      [stock({ price: 150 })],
    );

    expect(result.cash).toBe(5_000);
    expect(result.invested).toBe(1_500);
    expect(result.equity).toBe(6_500);
  });

  it("computes pnl against the starting fund", () => {
    const result = computeEquity(
      INITIAL_FUND_AMOUNT,
      [position({ quantity: 10 })],
      [stock({ price: 150 })],
    );

    expect(result.pnl).toBe(1_500);
    expect(result.pnlPercent).toBeCloseTo(15, 5);
  });

  it("reports a negative pnl when the account is down", () => {
    const result = computeEquity(0, [position({ quantity: 10 })], [
      stock({ price: 500 }),
    ]);

    expect(result.pnl).toBeLessThan(0);
    expect(result.pnlPercent).toBeLessThan(0);
  });
});

describe("player identity", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("has no player until one is saved", () => {
    expect(loadPlayer()).toBeNull();
  });

  it("round-trips a saved player", () => {
    const player = { id: "p1", name: "Erick", pinHash: "abc" };
    savePlayer(player);

    expect(loadPlayer()).toEqual(player);
  });

  it("rejects a stored player missing its fields", () => {
    localStorage.setItem("erick-market.player.v1", JSON.stringify({ id: "p1" }));
    expect(loadPlayer()).toBeNull();
  });

  it("survives corrupt storage", () => {
    localStorage.setItem("erick-market.player.v1", "{not json");
    expect(loadPlayer()).toBeNull();
  });

  it("clears the player", () => {
    savePlayer({ id: "p1", name: "Erick", pinHash: "abc" });
    clearPlayer();

    expect(loadPlayer()).toBeNull();
  });

  it("mints unique ids", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newPlayerId()));
    expect(ids.size).toBe(50);
  });
});

describe("local board", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is empty for a fresh month", () => {
    expect(getLocalBoard("2026-08")).toEqual([]);
  });

  it("records a score", () => {
    upsertLocalScore({
      playerId: "p1",
      name: "Erick",
      month: "2026-08",
      equity: 11_000,
      cash: 1_000,
      invested: 10_000,
      pnl: 1_000,
      pnlPercent: 10,
      updatedAt: new Date(2026, 7, 8).toISOString(),
    });

    const board = getLocalBoard("2026-08");
    expect(board).toHaveLength(1);
    expect(board[0].name).toBe("Erick");
  });

  it("replaces a player's earlier score rather than duplicating them", () => {
    const base = {
      playerId: "p1",
      name: "Erick",
      month: "2026-08",
      cash: 0,
      invested: 0,
      updatedAt: new Date(2026, 7, 8).toISOString(),
    };

    upsertLocalScore({ ...base, equity: 11_000, pnl: 1_000, pnlPercent: 10 });
    upsertLocalScore({ ...base, equity: 12_000, pnl: 2_000, pnlPercent: 20 });

    const board = getLocalBoard("2026-08");
    expect(board).toHaveLength(1);
    expect(board[0].equity).toBe(12_000);
  });

  it("ranks the board by equity", () => {
    const base = {
      month: "2026-08",
      cash: 0,
      invested: 0,
      pnl: 0,
      pnlPercent: 0,
      updatedAt: new Date(2026, 7, 8).toISOString(),
    };

    upsertLocalScore({ ...base, playerId: "p1", name: "Low", equity: 9_000 });
    upsertLocalScore({ ...base, playerId: "p2", name: "High", equity: 13_000 });

    expect(getLocalBoard("2026-08")[0].name).toBe("High");
  });

  it("keeps months apart", () => {
    upsertLocalScore({
      playerId: "p1",
      name: "Erick",
      month: "2026-07",
      equity: 1,
      cash: 0,
      invested: 0,
      pnl: 0,
      pnlPercent: 0,
      updatedAt: new Date(2026, 6, 8).toISOString(),
    });

    expect(getLocalBoard("2026-08")).toEqual([]);
    expect(getLocalBoard("2026-07")).toHaveLength(1);
  });
});
