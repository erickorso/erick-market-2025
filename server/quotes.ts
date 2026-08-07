export type QuoteRow = {
  symbol: string;
  company: string;
  price: number;
  change: number;
  changePercent: number;
};

export const WATCHLIST: { symbol: string; company: string }[] = [
  { symbol: "AAPL", company: "Apple" },
  { symbol: "MSFT", company: "Microsoft" },
  { symbol: "GOOGL", company: "Alphabet" },
  { symbol: "AMZN", company: "Amazon" },
  { symbol: "NVDA", company: "NVIDIA" },
  { symbol: "META", company: "Meta" },
  { symbol: "TSLA", company: "Tesla" },
  { symbol: "JPM", company: "JPMorgan" },
];

const CACHE_MS = 20_000;

type CacheEntry = { at: number; quotes: QuoteRow[] };

let cache: CacheEntry | null = null;

type FinnhubQuote = {
  c?: number;
  d?: number;
  dp?: number;
};

async function fetchOne(
  symbol: string,
  company: string,
  token: string,
): Promise<QuoteRow | null> {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as FinnhubQuote;
  const price = typeof data.c === "number" ? data.c : 0;
  if (!price || price <= 0) return null;
  return {
    symbol,
    company,
    price,
    change: typeof data.d === "number" ? data.d : 0,
    changePercent: typeof data.dp === "number" ? data.dp : 0,
  };
}

export async function getMarketQuotes(apiKey: string | undefined): Promise<{
  quotes: QuoteRow[];
  source: "live" | "unavailable";
  cached: boolean;
}> {
  if (!apiKey) {
    return { quotes: [], source: "unavailable", cached: false };
  }

  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    return { quotes: cache.quotes, source: "live", cached: true };
  }

  const settled = await Promise.all(
    WATCHLIST.map((w) => fetchOne(w.symbol, w.company, apiKey)),
  );
  const quotes = settled.filter((q): q is QuoteRow => q !== null);

  if (!quotes.length) {
    return { quotes: [], source: "unavailable", cached: false };
  }

  cache = { at: now, quotes };
  return { quotes, source: "live", cached: false };
}
