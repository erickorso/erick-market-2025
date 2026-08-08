import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchStocks,
  generateChartData,
  mergeLivePrices,
  parseCategory,
  tickStockPrices,
} from "./stockService";
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
    const previous = [
      stock({ id: "a" }),
      stock({ id: "b" }),
      stock({ id: "c" }),
    ];
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

describe("generateChartData", () => {
  it("produces a plottable series around the current price", () => {
    const series = generateChartData(100);

    expect(series.length).toBeGreaterThan(1);
    series.forEach((p) => {
      expect(p.price).toBeGreaterThan(0);
      expect(typeof p.name).toBe("string");
    });
  });

  it("ends at the price it was given", () => {
    const series = generateChartData(123.45);
    expect(series.at(-1)?.price).toBeCloseTo(123.45, 1);
  });
});

describe("fetchStocks", () => {
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

  const liveRow = {
    symbol: "AAPL",
    company: "Apple Inc.",
    price: 190,
    change: 2,
    changePercent: 1.1,
    tags: ["growth"],
    chart: [{ name: "5/1", price: 188 }],
    chartSource: "yahoo",
  };

  it("passes paging and filters to the API", async () => {
    fetchMock.mockResolvedValue(ok({ stocks: [liveRow], source: "live" }));

    await fetchStocks({ q: "aapl", category: "growth", offset: 20, limit: 5 });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("q=aapl");
    expect(url).toContain("category=growth");
    expect(url).toContain("offset=20");
    expect(url).toContain("limit=5");
  });

  it("omits an empty search and the default category", async () => {
    fetchMock.mockResolvedValue(ok({ stocks: [liveRow], source: "live" }));

    await fetchStocks({});

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).not.toContain("q=");
    expect(url).not.toContain("category=");
  });

  it("normalises the live rows", async () => {
    fetchMock.mockResolvedValue(
      ok({ stocks: [liveRow], source: "live", total: 40, hasMore: true }),
    );

    const result = await fetchStocks({});

    expect(result.source).toBe("live");
    expect(result.total).toBe(40);
    expect(result.hasMore).toBe(true);
    expect(result.stocks[0].symbol).toBe("AAPL");
    expect(result.stocks[0].price).toBe(190);
  });

  it("falls back to mock data when the API is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const result = await fetchStocks({});

    expect(result.source).toBe("mock");
    expect(result.stocks.length).toBeGreaterThan(0);
  });

  it("falls back to mock data on an empty non-live response", async () => {
    fetchMock.mockResolvedValue(ok({ stocks: [], source: "unavailable" }));

    const result = await fetchStocks({});
    expect(result.source).toBe("mock");
  });

  it("trusts an empty page that the API says is live", async () => {
    fetchMock.mockResolvedValue(ok({ stocks: [], source: "live", total: 0 }));

    const result = await fetchStocks({});
    expect(result.source).toBe("live");
    expect(result.stocks).toEqual([]);
  });

  it("filters the mock catalog by search term", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const result = await fetchStocks({ q: "AAPL" });

    expect(result.stocks.length).toBeGreaterThan(0);
    result.stocks.forEach((s) =>
      expect(`${s.symbol} ${s.company}`.toLowerCase()).toContain("aapl"),
    );
  });

  it("pages the mock catalog", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const first = await fetchStocks({ offset: 0, limit: 2 });
    const second = await fetchStocks({ offset: 2, limit: 2 });

    expect(first.stocks).toHaveLength(2);
    expect(second.stocks[0].id).not.toBe(first.stocks[0].id);
  });

  it("filters the mock catalog by category", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const result = await fetchStocks({ category: "dividend", limit: 50 });

    expect(result.stocks.length).toBeGreaterThan(0);
    result.stocks.forEach((s) => expect(s.tags).toContain("dividend"));
  });

  it("sorts day gainers best first", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const { stocks } = await fetchStocks({ category: "gainers", limit: 10 });
    const changes = stocks.map((s) => s.changePercent ?? 0);

    expect([...changes].sort((a, b) => b - a)).toEqual(changes);
  });

  it("sorts day losers worst first", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const { stocks } = await fetchStocks({ category: "losers", limit: 10 });
    const changes = stocks.map((s) => s.changePercent ?? 0);

    expect([...changes].sort((a, b) => a - b)).toEqual(changes);
  });

  it("labels the mock rows as simulated", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const { stocks } = await fetchStocks({ limit: 3 });
    stocks.forEach((s) => expect(s.chartSource).toBe("simulated"));
  });
});

describe("row normalisation", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function live(row: Record<string, unknown>) {
    return {
      ok: true,
      json: async () => ({ stocks: [row], source: "live" }),
    } as Response;
  }

  it("appends the ticker to the company label", async () => {
    fetchMock.mockResolvedValue(
      live({ symbol: "AAPL", company: "Apple Inc.", price: 190 }),
    );

    const { stocks } = await fetchStocks({});
    expect(stocks[0].company).toBe("Apple Inc. (AAPL)");
  });

  it("leaves the label alone when there is no ticker", async () => {
    fetchMock.mockResolvedValue(live({ company: "Mystery Co", price: 1 }));

    const { stocks } = await fetchStocks({});
    expect(stocks[0].company).toBe("Mystery Co");
  });

  it("coerces a price sent as a string", async () => {
    fetchMock.mockResolvedValue(
      live({ symbol: "AAPL", company: "Apple", price: "190.50" }),
    );

    expect((await fetchStocks({})).stocks[0].price).toBe(190.5);
  });

  it("keeps a real series and its provenance", async () => {
    fetchMock.mockResolvedValue(
      live({
        symbol: "AAPL",
        company: "Apple",
        price: 190,
        chart: [
          { name: "5/1", price: 188 },
          { name: "5/2", price: 190 },
        ],
        chartSource: "yahoo",
      }),
    );

    const { stocks } = await fetchStocks({});

    expect(stocks[0].chartSource).toBe("yahoo");
    expect(stocks[0].chartData).toHaveLength(2);
  });

  it("normalises a live-labelled series to yahoo", async () => {
    fetchMock.mockResolvedValue(
      live({
        symbol: "AAPL",
        company: "Apple",
        price: 190,
        chart: [
          { name: "5/1", price: 188 },
          { name: "5/2", price: 190 },
        ],
        chartSource: "live",
      }),
    );

    expect((await fetchStocks({})).stocks[0].chartSource).toBe("yahoo");
  });

  it("simulates a series when the row carries only one point", async () => {
    fetchMock.mockResolvedValue(
      live({
        symbol: "AAPL",
        company: "Apple",
        price: 190,
        chart: [{ name: "5/1", price: 188 }],
        chartSource: "yahoo",
      }),
    );

    const { stocks } = await fetchStocks({});

    expect(stocks[0].chartSource).toBe("simulated");
    expect(stocks[0].chartData.length).toBeGreaterThan(1);
  });

  it("simulates a series when the row carries none", async () => {
    fetchMock.mockResolvedValue(
      live({ symbol: "AAPL", company: "Apple", price: 190 }),
    );

    const { stocks } = await fetchStocks({});

    expect(stocks[0].chartSource).toBe("simulated");
    expect(stocks[0].chartData.length).toBeGreaterThan(1);
  });
});
