import type { VercelRequest, VercelResponse } from "@vercel/node";

type QuoteRow = {
  symbol: string;
  company: string;
  price: number;
  change: number;
  changePercent: number;
};

const WATCHLIST: { symbol: string; company: string }[] = [
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
let cache: { at: number; quotes: QuoteRow[] } | null = null;

type FinnhubQuote = { c?: number; d?: number; dp?: number };

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

async function getQuotes(apiKey: string | undefined) {
  if (!apiKey) {
    return { quotes: [] as QuoteRow[], source: "unavailable" as const, cached: false };
  }
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    return { quotes: cache.quotes, source: "live" as const, cached: true };
  }
  const settled = await Promise.all(
    WATCHLIST.map((w) => fetchOne(w.symbol, w.company, apiKey)),
  );
  const quotes = settled.filter((q): q is QuoteRow => q !== null);
  if (!quotes.length) {
    return { quotes: [], source: "unavailable" as const, cached: false };
  }
  cache = { at: now, quotes };
  return { quotes, source: "live" as const, cached: false };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "GET") {
      res.status(405).json({ error: "method not allowed" });
      return;
    }

    const result = await getQuotes(process.env.FINNHUB_API_KEY);
    if (result.source !== "live") {
      res.status(503).json({
        stocks: [],
        source: "unavailable",
        error: "FINNHUB_API_KEY missing or Finnhub returned no quotes",
      });
      return;
    }

    res.status(200).json({
      stocks: result.quotes.map((q) => ({
        symbol: q.symbol,
        company: q.company,
        name: q.company,
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
      })),
      source: result.source,
      cached: result.cached,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "quotes failed",
    });
  }
}
