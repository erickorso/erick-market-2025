import { describe, expect, it } from "vitest";
import {
  computeEquity,
  currentMonthKey,
  portfolioMarketValue,
  previousMonthKey,
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
