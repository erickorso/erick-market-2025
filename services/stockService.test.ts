import { describe, expect, it } from "vitest";
import { mergeLivePrices, parseCategory, tickStockPrices } from "./stockService";
import type { EnrichedStock } from "../types";

function stock(over: Partial<EnrichedStock> = {}): EnrichedStock {
  return {
    id: "aapl",
    company: "Apple (AAPL)",
    price: 100,
    chartData: [{ name: "T-1", price: 99 }],
    ...over,
  };
}

describe("parseCategory", () => {
  it("accepts the curated style tags", () => {
    expect(parseCategory("growth")).toBe("growth");
    expect(parseCategory("blue-chip")).toBe("blue-chip");
  });

  it("accepts the day-mover pseudo categories", () => {
    expect(parseCategory("gainers")).toBe("gainers");
    expect(parseCategory("losers")).toBe("losers");
  });

  it("is case insensitive and trims", () => {
    expect(parseCategory("  GROWTH ")).toBe("growth");
  });

  it("falls back to all for anything unknown", () => {
    expect(parseCategory("nonsense")).toBe("all");
    expect(parseCategory(null)).toBe("all");
    expect(parseCategory(undefined)).toBe("all");
    expect(parseCategory("")).toBe("all");
  });
});

describe("mergeLivePrices", () => {
  it("keeps the previous order and length when the poll returns fewer rows", () => {
    const previous = [stock({ id: "a" }), stock({ id: "b" }), stock({ id: "c" })];
    const merged = mergeLivePrices(previous, [stock({ id: "b", price: 200 })]);

    expect(merged.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(merged[1].price).toBe(200);
  });

  it("leaves rows absent from the poll untouched", () => {
    const previous = [stock({ id: "a", price: 10 })];
    const merged = mergeLivePrices(previous, []);

    expect(merged[0]).toBe(previous[0]);
  });

  it("prefers real history over the simulated series", () => {
    const previous = [stock({ chartSource: "simulated" })];
    const merged = mergeLivePrices(previous, [
      stock({
        price: 120,
        chartSource: "yahoo",
        chartData: [{ name: "5/1", price: 118 }],
      }),
    ]);

    expect(merged[0].chartSource).toBe("yahoo");
    expect(merged[0].chartData).toEqual([{ name: "5/1", price: 118 }]);
  });

  it("does not downgrade real history back to simulated", () => {
    const previous = [
      stock({ chartSource: "yahoo", chartData: [{ name: "5/1", price: 90 }] }),
    ];
    const merged = mergeLivePrices(previous, [
      stock({ price: 120, chartSource: "simulated" }),
    ]);

    expect(merged[0].chartSource).toBe("yahoo");
    expect(merged[0].chartData).toEqual([{ name: "5/1", price: 90 }]);
  });

  it("appends a Now point to the simulated series and caps its length", () => {
    const previous = [
      stock({
        chartSource: "simulated",
        chartData: Array.from({ length: 20 }, (_, i) => ({
          name: `T-${i}`,
          price: 100 + i,
        })),
      }),
    ];
    const merged = mergeLivePrices(previous, [
      stock({ price: 130, chartSource: "simulated" }),
    ]);

    expect(merged[0].chartData).toHaveLength(10);
    expect(merged[0].chartData.at(-1)).toEqual({ name: "Now", price: 130 });
  });

  it("keeps previous tags when the poll omits them", () => {
    const previous = [stock({ tags: ["growth"] })];
    const merged = mergeLivePrices(previous, [stock({ tags: [] })]);

    expect(merged[0].tags).toEqual(["growth"]);
  });
});

describe("tickStockPrices", () => {
  it("keeps every company and returns positive prices", () => {
    const ticked = tickStockPrices([stock({ id: "a" }), stock({ id: "b" })]);

    expect(ticked.map((s) => s.id)).toEqual(["a", "b"]);
    ticked.forEach((s) => expect(s.price).toBeGreaterThan(0));
  });

  it("returns a new array rather than mutating the input", () => {
    const input = [stock()];
    const ticked = tickStockPrices(input);

    expect(ticked).not.toBe(input);
    expect(input[0].price).toBe(100);
  });

  it("moves prices by a small amount, not wildly", () => {
    const ticked = tickStockPrices([stock({ price: 100 })]);
    expect(Math.abs(ticked[0].price - 100)).toBeLessThan(20);
  });
});
