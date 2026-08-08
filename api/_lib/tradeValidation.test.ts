import { describe, expect, it } from "vitest";
import { computeEquityFromBooks, parseTradeInput } from "./tradeValidation";

describe("parseTradeInput", () => {
  it("accepts a valid buy", () => {
    const t = parseTradeInput({
      side: "buy",
      symbol: "aapl",
      company: "Apple",
      qty: 2,
      price: 100,
    });
    expect(t).toEqual({
      side: "buy",
      symbol: "AAPL",
      company: "Apple",
      qty: 2,
      price: 100,
    });
  });

  it("rejects invalid side", () => {
    expect(() =>
      parseTradeInput({ side: "hold", symbol: "AAPL", qty: 1, price: 1 }),
    ).toThrow(/side/i);
  });

  it("rejects NaN qty", () => {
    expect(() =>
      parseTradeInput({ side: "buy", symbol: "AAPL", qty: NaN, price: 10 }),
    ).toThrow(/quantity/i);
  });

  it("rejects Infinity price", () => {
    expect(() =>
      parseTradeInput({
        side: "sell",
        symbol: "AAPL",
        qty: 1,
        price: Infinity,
      }),
    ).toThrow(/price/i);
  });

  it("rejects negative qty", () => {
    expect(() =>
      parseTradeInput({ side: "buy", symbol: "AAPL", qty: -1, price: 10 }),
    ).toThrow(/quantity/i);
  });

  it("rejects empty symbol", () => {
    expect(() =>
      parseTradeInput({ side: "buy", symbol: "  ", qty: 1, price: 10 }),
    ).toThrow(/symbol/i);
  });

  it("uses the symbol when company is missing and trims it", () => {
    expect(
      parseTradeInput({ side: "sell", symbol: " msft ", qty: 1, price: 25 }),
    ).toMatchObject({
      symbol: "MSFT",
      company: "MSFT",
    });
  });

  it.each([
    ["zero quantity", { qty: 0, price: 10 }, /quantity/i],
    ["zero price", { qty: 1, price: 0 }, /price/i],
    ["oversized quantity", { qty: 1_000_001, price: 10 }, /quantity/i],
    ["oversized price", { qty: 1, price: 1_000_001 }, /price/i],
  ])("rejects %s", (_label, values, message) => {
    expect(() =>
      parseTradeInput({ side: "buy", symbol: "AAPL", ...values }),
    ).toThrow(message);
  });
});

describe("computeEquityFromBooks", () => {
  it("computes MTM equity, pnl and invested", () => {
    const score = computeEquityFromBooks(
      4000,
      [
        { qty: 10, price: 100 },
        { qty: 2, price: 50 },
      ],
      10_000,
    );
    expect(score.invested).toBe(1100);
    expect(score.equity).toBe(5100);
    expect(score.pnl).toBe(-4900);
    expect(score.pnlPct).toBeCloseTo(-49);
    expect(score.cash).toBe(4000);
  });

  it("handles empty positions", () => {
    const score = computeEquityFromBooks(10_000, [], 10_000);
    expect(score.equity).toBe(10_000);
    expect(score.invested).toBe(0);
    expect(score.pnl).toBe(0);
  });
});
