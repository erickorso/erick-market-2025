import {
  CATEGORIES,
  PAGE_SIZE,
  WATCHLIST,
  filterWatchlist,
  parseCategory,
  tagsForSymbol,
  type CategoryId,
  type StyleTag,
  type WatchItem,
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
  quoteSource?: "live" | "simulated";
};

type FinnhubQuote = { c?: number; d?: number; dp?: number };
type FinnhubSymbol = { symbol?: string; description?: string; type?: string };

const MAX_UNIVERSE = 500;
const QUOTE_TTL_MS = 20_000;
const UNIVERSE_TTL_MS = 6 * 60 * 60 * 1000;
const quoteCache = new Map<string, { at: number; quote: QuoteRow }>();
let universeCache: { at: number; items: WatchItem[] } | null = null;

function fallbackQuote(symbol: string, company: string): QuoteRow {
  const seed = [...symbol].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return {
    symbol,
    company,
    price: Number((40 + (seed % 460) + (seed % 100) / 100).toFixed(2)),
    change: 0,
    changePercent: 0,
    tags: tagsForSymbol(symbol),
    quoteSource: "simulated",
  };
}

async function getUniverse(token: string): Promise<WatchItem[]> {
  if (universeCache && Date.now() - universeCache.at < UNIVERSE_TTL_MS) {
    return universeCache.items;
  }

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${encodeURIComponent(token)}`,
    );
    if (!response.ok) throw new Error("symbol universe unavailable");
    const rows = (await response.json()) as FinnhubSymbol[];
    const curated = new Map(WATCHLIST.map((item) => [item.symbol, item]));
    const discovered = rows
      .filter(
        (row) =>
          row.type === "Common Stock" &&
          typeof row.symbol === "string" &&
          /^[A-Z][A-Z0-9.-]{0,9}$/.test(row.symbol),
      )
      .map((row) => ({
        symbol: row.symbol as string,
        company: row.description?.trim() || (row.symbol as string),
        tags: curated.get(row.symbol as string)?.tags ?? [],
      }));
    const merged = new Map<string, WatchItem>();
    [...WATCHLIST, ...discovered].forEach((item) =>
      merged.set(item.symbol, item),
    );
    universeCache = {
      at: Date.now(),
      items: [...merged.values()].slice(0, MAX_UNIVERSE),
    };
  } catch {
    universeCache = { at: Date.now(), items: WATCHLIST };
  }
  return universeCache.items;
}

async function fetchOne(symbol: string, company: string, token: string) {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.at < QUOTE_TTL_MS) return cached.quote;

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`,
    );
    if (!response.ok) return fallbackQuote(symbol, company);
    const data = (await response.json()) as FinnhubQuote;
    if (typeof data.c !== "number" || data.c <= 0) {
      return fallbackQuote(symbol, company);
    }
    const quote: QuoteRow = {
      symbol,
      company,
      price: data.c,
      change: typeof data.d === "number" ? data.d : 0,
      changePercent: typeof data.dp === "number" ? data.dp : 0,
      tags: tagsForSymbol(symbol),
      quoteSource: "live",
    };
    quoteCache.set(symbol, { at: Date.now(), quote });
    return quote;
  } catch {
    return fallbackQuote(symbol, company);
  }
}

async function fetchMany(items: WatchItem[], token: string, concurrency = 5) {
  const result: QuoteRow[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    result.push(
      ...(await Promise.all(
        chunk.map((item) => fetchOne(item.symbol, item.company, token)),
      )),
    );
  }
  return result;
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
  const limit = Math.min(Math.max(1, opts.limit ?? PAGE_SIZE), MAX_UNIVERSE);
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

  const universe = isDayMovers(category)
    ? WATCHLIST
    : await getUniverse(apiKey);
  const filtered = isDayMovers(category)
    ? filterWatchlist(q, category)
    : universe.filter(
        (item) =>
          !q || `${item.symbol} ${item.company}`.toLowerCase().includes(q),
      );
  let rows = await fetchMany(
    isDayMovers(category) ? filtered : filtered.slice(offset, offset + limit),
    apiKey,
  );

  if (isDayMovers(category)) {
    rows.sort((a, b) =>
      category === "gainers"
        ? b.changePercent - a.changePercent
        : a.changePercent - b.changePercent,
    );
    rows = rows.slice(offset, offset + limit);
  }

  const quotes = await attachYahooCharts(rows, "1mo", 20);
  const total = filtered.length;
  return {
    quotes,
    source: quotes.length ? ("live" as const) : ("unavailable" as const),
    total,
    offset,
    limit,
    hasMore: offset + limit < total,
    category,
    categories: CATEGORIES,
  };
}

export async function getMarketQuotes(apiKey: string | undefined) {
  return getMarketQuotesPage(apiKey, { offset: 0, limit: MAX_UNIVERSE });
}
