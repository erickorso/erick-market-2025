import { DETAIL_API_URL } from "../constants";
import type { ChartDataPoint, StyleTag } from "../types";
import { generateChartData } from "./stockService";
import { WATCHLIST } from "../server/watchlist";

export type StockDetail = {
  source: "live" | "mock";
  chartSource: "live" | "simulated";
  symbol: string;
  company: string;
  tags: StyleTag[];
  quote: {
    price: number;
    change: number;
    changePercent: number;
    high: number | null;
    low: number | null;
    open: number | null;
    previousClose: number | null;
  };
  profile: {
    exchange: string | null;
    industry: string | null;
    logo: string | null;
    weburl: string | null;
    marketCap: number | null;
    sharesOutstanding: number | null;
    ipo: string | null;
    country: string | null;
    currency: string | null;
  };
  chart: ChartDataPoint[];
};

function mockDetail(symbol: string, seed?: Partial<StockDetail>): StockDetail {
  const watch = WATCHLIST.find((w) => w.symbol === symbol.toUpperCase());
  const price = seed?.quote?.price ?? 100 + Math.random() * 50;
  return {
    source: "mock",
    chartSource: "simulated",
    symbol: symbol.toUpperCase(),
    company: seed?.company ?? watch?.company ?? symbol.toUpperCase(),
    tags: (seed?.tags as StyleTag[]) ?? watch?.tags ?? [],
    quote: {
      price,
      change: seed?.quote?.change ?? 1.2,
      changePercent: seed?.quote?.changePercent ?? 1.1,
      high: price * 1.02,
      low: price * 0.98,
      open: price * 0.995,
      previousClose: price * 0.99,
    },
    profile: {
      exchange: "NASDAQ",
      industry: "Technology",
      logo: null,
      weburl: null,
      marketCap: 500_000,
      sharesOutstanding: 1000,
      ipo: null,
      country: "US",
      currency: "USD",
    },
    chart: generateChartData(price),
  };
}

export async function fetchStockDetail(
  symbol: string,
  seed?: Partial<StockDetail>,
): Promise<StockDetail> {
  const sym = symbol.trim().toUpperCase();
  try {
    const res = await fetch(
      `${DETAIL_API_URL}?symbol=${encodeURIComponent(sym)}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      source?: string;
      chartSource?: string;
      symbol?: string;
      company?: string;
      tags?: StyleTag[];
      quote?: StockDetail["quote"];
      profile?: StockDetail["profile"];
      chart?: ChartDataPoint[];
    };
    const price = data.quote?.price ?? 0;
    const liveChart =
      data.chartSource === "live" && Array.isArray(data.chart) && data.chart.length > 0
        ? data.chart
        : null;
    return {
      source: "live",
      chartSource: liveChart ? "live" : "simulated",
      symbol: data.symbol ?? sym,
      company: data.company ?? sym,
      tags: data.tags ?? [],
      quote: data.quote ?? {
        price,
        change: 0,
        changePercent: 0,
        high: null,
        low: null,
        open: null,
        previousClose: null,
      },
      profile: data.profile ?? {
        exchange: null,
        industry: null,
        logo: null,
        weburl: null,
        marketCap: null,
        sharesOutstanding: null,
        ipo: null,
        country: null,
        currency: "USD",
      },
      chart: liveChart ?? generateChartData(price || 100),
    };
  } catch {
    return mockDetail(sym, seed);
  }
}

export function formatMarketCap(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m)) return "—";
  // Finnhub marketCapitalization is in millions
  if (m >= 1_000_000) return `$${(m / 1_000_000).toFixed(2)}T`;
  if (m >= 1_000) return `$${(m / 1_000).toFixed(2)}B`;
  return `$${m.toFixed(1)}M`;
}
