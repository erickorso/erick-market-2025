import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  CATEGORIES,
  PAGE_SIZE,
  filterWatchlist,
  tagsForSymbol,
  type StyleTag,
} from "../server/watchlist";

/** Mirrors server/hot.ts — self-contained for Vercel. */
const HOT_LIMIT = 8;
const HOT_INTERVAL_MS = 5 * 60 * 1000;

type QuoteRow = {
  symbol: string;
  company: string;
  price: number;
  change: number;
  changePercent: number;
  tags: StyleTag[];
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

    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        type: "hot",
        at: Date.now(),
        intervalMs: HOT_INTERVAL_MS,
        source: "unavailable",
        stocks: [],
        categories: CATEGORIES,
        pageSize: PAGE_SIZE,
      });
      return;
    }

    const filtered = filterWatchlist("", "gainers");
    const settled = await Promise.all(
      filtered.map((w) => fetchOne(w.symbol, w.company, apiKey)),
    );
    const quotes = settled
      .filter((x): x is QuoteRow => x !== null)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, HOT_LIMIT);

    res.status(200).json({
      type: "hot",
      at: Date.now(),
      intervalMs: HOT_INTERVAL_MS,
      source: "live",
      stocks: quotes.map((q) => ({
        symbol: q.symbol,
        company: q.company,
        price: q.price,
        changePercent: q.changePercent,
      })),
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "hot failed",
    });
  }
}
