import type { ApiStockRow, ChartDataPoint, EnrichedStock } from "../types";
import { QUOTES_API_URL } from "../constants";
import {
  CATEGORIES,
  PAGE_SIZE,
  WATCHLIST,
  filterWatchlist,
  parseCategory,
  type CategoryId,
  type StyleTag,
} from "../server/watchlist";

export function generateChartData(currentPrice: number): ChartDataPoint[] {
  const data: ChartDataPoint[] = [];
  const points = 10;
  const base = Math.max(0.01, currentPrice);
  for (let i = 0; i < points; i++) {
    const fluctuation = (Math.random() - 0.5) * base * 0.04;
    data.push({
      name: `T-${points - 1 - i}`,
      price: Math.max(0.01, base + fluctuation * (i / points)),
    });
  }
  data.push({ name: "Now", price: base });
  return data;
}

function mockRows(): ApiStockRow[] {
  return WATCHLIST.map((w, i) => {
    const changePercent = ((i * 17) % 21) - 10 + (i % 3) * 0.3;
    return {
      symbol: w.symbol,
      company: w.company,
      name: w.company,
      price: 50 + ((i * 37) % 400) + Math.random() * 10,
      change: changePercent,
      changePercent,
      tags: w.tags,
    };
  });
}

function normalizeRow(row: ApiStockRow, index: number): EnrichedStock {
  const companyRaw =
    (typeof row.company === "string" && row.company.trim()) ||
    (typeof row.name === "string" && row.name.trim()) ||
    `Unknown Company ${index}`;
  const company = companyRaw.trim();
  const symbol =
    typeof row.symbol === "string" && row.symbol.trim()
      ? row.symbol.trim().toUpperCase()
      : undefined;
  const priceNum =
    typeof row.price === "number"
      ? row.price
      : typeof row.price === "string"
        ? Number.parseFloat(row.price)
        : NaN;
  const price = Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : 0;
  const id = (symbol ?? company).replace(/\s+/g, "-").toLowerCase();
  const changePercent =
    typeof row.changePercent === "number" && Number.isFinite(row.changePercent)
      ? row.changePercent
      : undefined;
  const tags = Array.isArray(row.tags)
    ? (row.tags.filter(Boolean) as StyleTag[])
    : symbol
      ? (WATCHLIST.find((w) => w.symbol === symbol)?.tags ?? [])
      : [];
  return {
    id,
    company: symbol ? `${company} (${symbol})` : company,
    price,
    chartData: generateChartData(price),
    tags,
    changePercent,
  };
}

export type DataSource = "live" | "mock";

export type FetchStocksResult = {
  stocks: EnrichedStock[];
  source: DataSource;
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  category: CategoryId;
};

export type FetchStocksParams = {
  q?: string;
  offset?: number;
  limit?: number;
  category?: CategoryId | string;
};

async function fetchJson(url: string, ms = 12000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export function mergeLivePrices(
  previous: EnrichedStock[],
  next: EnrichedStock[],
): EnrichedStock[] {
  const prevById = new Map(previous.map((s) => [s.id, s]));
  return next.map((stock) => {
    const old = prevById.get(stock.id);
    if (!old) return stock;
    const chartData = [
      ...old.chartData.slice(-9).map((p, i, arr) => ({
        ...p,
        name: `T-${arr.length - i}`,
      })),
      { name: "Now", price: stock.price },
    ];
    return {
      ...stock,
      chartData,
      tags: stock.tags?.length ? stock.tags : old.tags,
    };
  });
}

function paginateMock(params: FetchStocksParams): FetchStocksResult {
  const category = parseCategory(params.category);
  const q = (params.q ?? "").trim().toLowerCase();
  const limit = params.limit ?? PAGE_SIZE;
  const offset = params.offset ?? 0;

  let all = mockRows().filter((row) => {
    const textOk =
      !q ||
      (row.symbol ?? "").toLowerCase().includes(q) ||
      (row.company ?? "").toLowerCase().includes(q) ||
      (row.name ?? "").toLowerCase().includes(q);
    if (!textOk) return false;
    if (category === "all" || category === "gainers" || category === "losers") {
      return true;
    }
    return (row.tags ?? []).includes(category);
  });

  if (category === "gainers" || category === "losers") {
    all = [...all].sort((a, b) => {
      const ap = Number(a.changePercent ?? 0);
      const bp = Number(b.changePercent ?? 0);
      return category === "gainers" ? bp - ap : ap - bp;
    });
  } else {
    // keep watchlist order via filterWatchlist for consistency
    const order = new Map(
      filterWatchlist(q, category).map((w, i) => [w.symbol, i]),
    );
    all = [...all].sort(
      (a, b) =>
        (order.get(a.symbol ?? "") ?? 0) - (order.get(b.symbol ?? "") ?? 0),
    );
  }

  const slice = all.slice(offset, offset + limit);
  return {
    stocks: slice.map(normalizeRow),
    source: "mock",
    total: all.length,
    offset,
    limit,
    hasMore: offset + limit < all.length,
    category,
  };
}

export async function fetchStocks(
  params: FetchStocksParams = {},
): Promise<FetchStocksResult> {
  const q = params.q?.trim() ?? "";
  const offset = params.offset ?? 0;
  const limit = params.limit ?? PAGE_SIZE;
  const category = parseCategory(params.category);
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (category !== "all") sp.set("category", category);
  sp.set("offset", String(offset));
  sp.set("limit", String(limit));
  const url = `${QUOTES_API_URL}?${sp.toString()}`;

  try {
    const data = (await fetchJson(url)) as {
      stocks?: ApiStockRow[];
      source?: string;
      total?: number;
      offset?: number;
      limit?: number;
      hasMore?: boolean;
      category?: string;
    };
    const raw = Array.isArray(data.stocks) ? data.stocks : [];
    if (raw.length || data.source === "live") {
      return {
        stocks: raw.map(normalizeRow),
        source: "live",
        total: data.total ?? raw.length,
        offset: data.offset ?? offset,
        limit: data.limit ?? limit,
        hasMore: Boolean(data.hasMore),
        category: parseCategory(data.category ?? category),
      };
    }
  } catch {
    /* mock */
  }

  return paginateMock(params);
}

export function tickStockPrices(stocks: EnrichedStock[]): EnrichedStock[] {
  return stocks.map((stock) => {
    const drift = 1 + (Math.random() - 0.5) * 0.03;
    const next = Math.max(0.01, Number((stock.price * drift).toFixed(2)));
    const chartData = [
      ...stock.chartData.slice(-9),
      { name: "Now", price: next },
    ];
    const labeled = chartData.map((p, i, arr) =>
      i === arr.length - 1 ? p : { ...p, name: `T-${arr.length - 1 - i}` },
    );
    return { ...stock, price: next, chartData: labeled };
  });
}

export { PAGE_SIZE, CATEGORIES, parseCategory };
export type { CategoryId };
