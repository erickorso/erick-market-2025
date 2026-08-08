import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchStockDetail, formatMarketCap } from "./detailService";
import { COMPANY_SITES } from "../server/watchlist";

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("formatMarketCap", () => {
  // Finnhub reports market cap in millions, so the input unit is millions.
  it("renders trillions, billions and millions", () => {
    expect(formatMarketCap(4_330_000)).toBe("$4.33T");
    expect(formatMarketCap(500_000)).toBe("$500.00B");
    expect(formatMarketCap(250)).toBe("$250.0M");
  });

  it("switches unit exactly at the thresholds", () => {
    expect(formatMarketCap(999)).toBe("$999.0M");
    expect(formatMarketCap(1_000)).toBe("$1.00B");
    expect(formatMarketCap(999_999)).toBe("$1000.00B");
    expect(formatMarketCap(1_000_000)).toBe("$1.00T");
  });

  it("renders a dash when the figure is missing", () => {
    expect(formatMarketCap(null)).toBe("—");
    expect(formatMarketCap(undefined)).toBe("—");
  });
});

describe("fetchStockDetail", () => {
  it("maps a live payload and marks the source live", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          symbol: "AAPL",
          company: "Apple Inc.",
          chartSource: "yahoo",
          chart: [{ name: "5/1", price: 180 }],
          quote: {
            price: 190,
            change: 2,
            changePercent: 1.1,
            high: 192,
            low: 187,
            open: 188,
            previousClose: 188,
          },
          profile: { exchange: "NASDAQ", weburl: "https://apple.example" },
        }),
      ),
    );

    const detail = await fetchStockDetail("aapl");

    expect(detail.source).toBe("live");
    expect(detail.symbol).toBe("AAPL");
    expect(detail.quote.price).toBe(190);
    expect(detail.chartSource).toBe("yahoo");
    expect(detail.profile.weburl).toBe("https://apple.example");
  });

  it("backfills the company site when the provider omits weburl", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          symbol: "MSFT",
          company: "Microsoft",
          quote: { price: 400, change: 0, changePercent: 0 },
          profile: { exchange: "NASDAQ", weburl: null },
        }),
      ),
    );

    const detail = await fetchStockDetail("MSFT");

    expect(detail.profile.weburl).toBe(COMPANY_SITES.MSFT);
  });

  it("treats a simulated chart as such even on the live path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          symbol: "AAPL",
          chartSource: "simulated",
          chart: [],
          quote: { price: 100, change: 0, changePercent: 0 },
        }),
      ),
    );

    const detail = await fetchStockDetail("AAPL");

    expect(detail.chartSource).toBe("simulated");
    expect(detail.chart.length).toBeGreaterThan(0);
  });

  it("falls back to mock data when the API is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    const detail = await fetchStockDetail("MSFT");

    expect(detail.source).toBe("mock");
    expect(detail.chartSource).toBe("simulated");
    // The offline path still resolves the company site from the watchlist.
    expect(detail.profile.weburl).toBe(COMPANY_SITES.MSFT);
  });

  it("seeds the mock quote from the catalog row when one is passed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    const detail = await fetchStockDetail("AAPL", {
      quote: {
        price: 123.45,
        change: 1,
        changePercent: 1,
        high: null,
        low: null,
        open: null,
        previousClose: null,
      },
    });

    expect(detail.quote.price).toBe(123.45);
  });

  it("falls back to mock on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 }) as Response),
    );

    const detail = await fetchStockDetail("AAPL");
    expect(detail.source).toBe("mock");
  });
});
