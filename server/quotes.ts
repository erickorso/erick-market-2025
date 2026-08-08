import {
  CATEGORIES,
  PAGE_SIZE,
  WATCHLIST,
  filterWatchlist,
  parseCategory,
  tagsForSymbol,
  type CategoryId,
  type StyleTag,
} from "./watchlist";
import { attachYahooCharts } from "./yahooChart";

export type QuoteRow = {
  symbol: string;
  company: string;
  price: number;
  change: number;
  changePercent: number;
  tags: StyleTag[];
  chart?: { name: string; price: number }[];
  chartSource?: "yahoo" | "simulated";
};

const quoteCache = new Map<string, { at: number; quote: QuoteRow }>();
const QUOTE_TTL_MS = 20_000;

type FinnhubQuote = { c?: number; d?: number; dp?: number };

async function fetchOne(
  symbol: string,
  company: string,
  token: string,
): Promise<QuoteRow | null> {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.at < QUOTE_TTL_MS) {
    return cached.quote;
  }
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as FinnhubQuote;
  const price = typeof data.c === "number" ? data.c : 0;
  if (!price || price <= 0) return null;
  const quote: QuoteRow = {
    symbol,
    company,
    price,
    change: typeof data.d === "number" ? data.d : 0,
    changePercent: typeof data.dp === "number" ? data.dp : 0,
    tags: tagsForSymbol(symbol),
  };
  quoteCache.set(symbol, { at: Date.now(), quote });
  return quote;
}

function isDayMovers(category: CategoryId) {
  return category === "gainers" || category === "losers";
}

export async function getMarketQuotesPage(
  apiKey: string | undefined,
  opts: {
    q?: string;
    offset?: number;
    limit?: number;
    category?: string;
  } = {},
) {
  const category = parseCategory(opts.category);
  const q = (opts.q ?? "").trim().toLowerCase();
  const limit = Math.min(
    Math.max(1, opts.limit ?? PAGE_SIZE),
    WATCHLIST.length,
  );
  const offset = Math.max(0, opts.offset ?? 0);

  if (!apiKey) {
    return {
      quotes: [] as QuoteRow[],
      source: "unavailable" as const,
      total: 0,
      offset,
      limit,
      hasMore: false,
      category,
      categories: CATEGORIES,
    };
  }

  const filtered = filterWatchlist(q, category);

  if (isDayMovers(category)) {
    const settled = await Promise.all(
      filtered.map((w) => fetchOne(w.symbol, w.company, apiKey)),
    );
    let quotes = settled.filter((x): x is QuoteRow => x !== null);
    quotes = quotes.sort((a, b) =>
      category === "gainers"
        ? b.changePercent - a.changePercent
        : a.changePercent - b.changePercent,
    );
    const total = quotes.length;
    const page = await attachYahooCharts(
      quotes.slice(offset, offset + limit),
      "1mo",
      20,
    );
    return {
      quotes: page,
      source: page.length ? ("live" as const) : ("unavailable" as const),
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
      category,
      categories: CATEGORIES,
    };
  }

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);
  const settled = await Promise.all(
    page.map((w) => fetchOne(w.symbol, w.company, apiKey)),
  );
  const quotes = settled.filter((x): x is QuoteRow => x !== null);
  const withCharts = await attachYahooCharts(quotes, "1mo", 20);

  return {
    quotes: withCharts,
    source: withCharts.length ? ("live" as const) : ("unavailable" as const),
    total,
    offset,
    limit,
    hasMore: offset + limit < total,
    category,
    categories: CATEGORIES,
  };
}

/** @deprecated use getMarketQuotesPage */
export async function getMarketQuotes(apiKey: string | undefined) {
  return getMarketQuotesPage(apiKey, {
    offset: 0,
    limit: 40,
  });
}
