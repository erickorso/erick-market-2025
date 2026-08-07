import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Fully self-contained — no relative imports (Vercel ESM cold-start crash). */

type StyleTag =
  | "long-term"
  | "short-term"
  | "growth"
  | "dividend"
  | "blue-chip"
  | "volatile";

type WatchItem = { symbol: string; company: string; tags: StyleTag[] };

type QuoteRow = {
  symbol: string;
  company: string;
  price: number;
  change: number;
  changePercent: number;
};

const HOT_LIMIT = 8;
const HOT_INTERVAL_MS = 5 * 60 * 1000;

const WATCHLIST: WatchItem[] = [
  { symbol: "AAPL", company: "Apple", tags: ["long-term", "blue-chip", "growth"] },
  { symbol: "MSFT", company: "Microsoft", tags: ["long-term", "blue-chip", "growth"] },
  { symbol: "GOOGL", company: "Alphabet", tags: ["long-term", "blue-chip", "growth"] },
  { symbol: "AMZN", company: "Amazon", tags: ["long-term", "growth", "volatile"] },
  { symbol: "NVDA", company: "NVIDIA", tags: ["growth", "short-term", "volatile"] },
  { symbol: "META", company: "Meta", tags: ["growth", "volatile", "short-term"] },
  { symbol: "TSLA", company: "Tesla", tags: ["short-term", "volatile", "growth"] },
  { symbol: "JPM", company: "JPMorgan", tags: ["blue-chip", "dividend", "long-term"] },
  { symbol: "V", company: "Visa", tags: ["long-term", "blue-chip", "growth"] },
  { symbol: "MA", company: "Mastercard", tags: ["long-term", "blue-chip", "growth"] },
  { symbol: "JNJ", company: "Johnson & Johnson", tags: ["dividend", "blue-chip", "long-term"] },
  { symbol: "WMT", company: "Walmart", tags: ["dividend", "blue-chip", "long-term"] },
  { symbol: "PG", company: "Procter & Gamble", tags: ["dividend", "blue-chip", "long-term"] },
  { symbol: "XOM", company: "Exxon Mobil", tags: ["dividend", "blue-chip"] },
  { symbol: "CVX", company: "Chevron", tags: ["dividend", "blue-chip"] },
  { symbol: "HD", company: "Home Depot", tags: ["blue-chip", "dividend", "long-term"] },
  { symbol: "BAC", company: "Bank of America", tags: ["dividend", "short-term"] },
  { symbol: "KO", company: "Coca-Cola", tags: ["dividend", "blue-chip", "long-term"] },
  { symbol: "PEP", company: "PepsiCo", tags: ["dividend", "blue-chip", "long-term"] },
  { symbol: "COST", company: "Costco", tags: ["long-term", "blue-chip", "growth"] },
  { symbol: "AVGO", company: "Broadcom", tags: ["growth", "dividend", "volatile"] },
  { symbol: "CRM", company: "Salesforce", tags: ["growth", "short-term"] },
  { symbol: "NFLX", company: "Netflix", tags: ["growth", "volatile", "short-term"] },
  { symbol: "AMD", company: "AMD", tags: ["growth", "volatile", "short-term"] },
  { symbol: "INTC", company: "Intel", tags: ["volatile", "short-term", "dividend"] },
  { symbol: "ORCL", company: "Oracle", tags: ["blue-chip", "growth", "dividend"] },
  { symbol: "CSCO", company: "Cisco", tags: ["dividend", "blue-chip"] },
  { symbol: "DIS", company: "Disney", tags: ["blue-chip", "volatile"] },
  { symbol: "NKE", company: "Nike", tags: ["blue-chip", "growth"] },
  { symbol: "MCD", company: "McDonald's", tags: ["dividend", "blue-chip", "long-term"] },
  { symbol: "ADBE", company: "Adobe", tags: ["growth", "volatile"] },
  { symbol: "IBM", company: "IBM", tags: ["dividend", "blue-chip"] },
  { symbol: "QCOM", company: "Qualcomm", tags: ["growth", "dividend", "volatile"] },
  { symbol: "TXN", company: "Texas Instruments", tags: ["dividend", "blue-chip", "long-term"] },
  { symbol: "UBER", company: "Uber", tags: ["growth", "short-term", "volatile"] },
  { symbol: "ABNB", company: "Airbnb", tags: ["growth", "short-term", "volatile"] },
  { symbol: "PYPL", company: "PayPal", tags: ["volatile", "short-term"] },
  { symbol: "SQ", company: "Block", tags: ["volatile", "short-term", "growth"] },
  { symbol: "SHOP", company: "Shopify", tags: ["growth", "volatile", "short-term"] },
  { symbol: "SPOT", company: "Spotify", tags: ["growth", "volatile", "short-term"] },
];

const quoteCache = new Map<string, { at: number; quote: QuoteRow }>();
const QUOTE_TTL_MS = 20_000;

type FinnhubQuote = { c?: number; d?: number; dp?: number };

async function fetchOne(
  symbol: string,
  company: string,
  token: string,
): Promise<QuoteRow | null> {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.at < QUOTE_TTL_MS) return cached.quote;
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

async function fetchMany(items: WatchItem[], token: string, concurrency = 4) {
  const out: QuoteRow[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const settled = await Promise.all(
      chunk.map((w) => fetchOne(w.symbol, w.company, token)),
    );
    for (const row of settled) if (row) out.push(row);
  }
  return out;
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
      });
      return;
    }

    const volatile = WATCHLIST.filter((w) => w.tags.includes("volatile"));
    const pool = volatile.length >= HOT_LIMIT ? volatile : WATCHLIST;
    const quotes = await fetchMany(pool, apiKey, 4);
    const top = [...quotes]
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, HOT_LIMIT);

    res.status(200).json({
      type: "hot",
      at: Date.now(),
      intervalMs: HOT_INTERVAL_MS,
      source: "live",
      stocks: top.map((q) => ({
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
