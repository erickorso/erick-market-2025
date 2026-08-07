import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PAGE_SIZE, WATCHLIST } from "../server/watchlist";

type QuoteRow = {
  symbol: string;
  company: string;
  price: number;
  change: number;
  changePercent: number;
};

/** Per-symbol quote cache (Finnhub rate limits). */
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

function parsePaging(req: VercelRequest) {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const limitRaw = Number(req.query.limit ?? PAGE_SIZE);
  const offsetRaw = Number(req.query.offset ?? 0);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, Math.floor(limitRaw)), 25)
    : PAGE_SIZE;
  const offset = Number.isFinite(offsetRaw)
    ? Math.max(0, Math.floor(offsetRaw))
    : 0;
  return { q, limit, offset };
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
        stocks: [],
        source: "unavailable",
        error: "FINNHUB_API_KEY missing or Finnhub returned no quotes",
        total: 0,
        offset: 0,
        limit: PAGE_SIZE,
        hasMore: false,
      });
      return;
    }

    const { q, limit, offset } = parsePaging(req);
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

    res.status(200).json({
      stocks: quotes.map((row) => ({
        symbol: row.symbol,
        company: row.company,
        name: row.company,
        price: row.price,
        change: row.change,
        changePercent: row.changePercent,
      })),
      source: "live",
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
      q: q || undefined,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "quotes failed",
    });
  }
}
