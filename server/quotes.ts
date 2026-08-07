import { PAGE_SIZE, WATCHLIST } from "./watchlist";

export type QuoteRow = {
  symbol: string;
  company: string;
  price: number;
  change: number;
  changePercent: number;
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
  };
  quoteCache.set(symbol, { at: Date.now(), quote });
  return quote;
}

export async function getMarketQuotesPage(
  apiKey: string | undefined,
  opts: { q?: string; offset?: number; limit?: number } = {},
) {
  if (!apiKey) {
    return {
      quotes: [] as QuoteRow[],
      source: "unavailable" as const,
      total: 0,
      offset: 0,
      limit: PAGE_SIZE,
      hasMore: false,
    };
  }

  const q = (opts.q ?? "").trim().toLowerCase();
  const limit = Math.min(Math.max(1, opts.limit ?? PAGE_SIZE), 25);
  const offset = Math.max(0, opts.offset ?? 0);

  const filtered = !q
    ? WATCHLIST
    : WATCHLIST.filter(
        (w) =>
          w.symbol.toLowerCase().includes(q) ||
          w.company.toLowerCase().includes(q),
      );

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);
  const settled = await Promise.all(
    page.map((w) => fetchOne(w.symbol, w.company, apiKey)),
  );
  const quotes = settled.filter((x): x is QuoteRow => x !== null);

  return {
    quotes,
    source: quotes.length ? ("live" as const) : ("unavailable" as const),
    total,
    offset,
    limit,
    hasMore: offset + limit < total,
  };
}

/** @deprecated use getMarketQuotesPage */
export async function getMarketQuotes(apiKey: string | undefined) {
  return getMarketQuotesPage(apiKey, { offset: 0, limit: WATCHLIST.length });
}
