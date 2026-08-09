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

  // The server prices every trade itself, so a price in the body is inert
  // rather than rejected: an older client still sends one.
  it("ignores any price in the body", () => {
    expect(
      parseTradeInput({ side: "sell", symbol: "AAPL", qty: 1, price: 0.01 }),
    ).not.toHaveProperty("price");
  });

  it("accepts a body with no price at all", () => {
    expect(
      parseTradeInput({ side: "buy", symbol: "AAPL", qty: 1 }),
    ).toMatchObject({ side: "buy", symbol: "AAPL", qty: 1 });
  });

  it("does not reject an absurd price, it just disregards it", () => {
    expect(() =>
      parseTradeInput({ side: "buy", symbol: "AAPL", qty: 1, price: Infinity }),
    ).not.toThrow();
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
    ["oversized quantity", { qty: 1_000_001, price: 10 }, /quantity/i],
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
