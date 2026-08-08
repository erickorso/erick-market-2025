import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Fully self-contained — no relative imports (Vercel ESM cold-start crash).
 * The CORS/rate-limit/log block below mirrors api/_lib for the same reason;
 * change it here and in api/quotes.ts and api/detail.ts together. */

const ALLOWED_ORIGINS = [
  "https://erick-market-2025.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
  ...(process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
];
const PREVIEW_ORIGIN = /^https:\/\/erick-market-2025-[a-z0-9-]+\.vercel\.app$/;
const RATE_LIMIT = { limit: 120, windowMs: 60_000 };
const rateHits = new Map<string, number[]>();

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = Array.isArray(req.headers.origin)
    ? req.headers.origin[0]
    : req.headers.origin;
  if (
    origin &&
    (ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin))
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

/** Per-instance sliding window. The CDN cache below is the real quota guard. */
function rateLimited(req: VercelRequest, res: VercelResponse): boolean {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const key = raw?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const hits = (rateHits.get(key) ?? []).filter(
    (at) => at > now - RATE_LIMIT.windowMs,
  );

  if (rateHits.size > 10_000) rateHits.clear();
  res.setHeader("X-RateLimit-Limit", String(RATE_LIMIT.limit));

  if (hits.length >= RATE_LIMIT.limit) {
    rateHits.set(key, hits);
    res.setHeader("X-RateLimit-Remaining", "0");
    res.setHeader(
      "Retry-After",
      String(
        Math.max(1, Math.ceil((hits[0] + RATE_LIMIT.windowMs - now) / 1000)),
      ),
    );
    res.status(429).json({ error: "rate limit exceeded" });
    return true;
  }

  hits.push(now);
  rateHits.set(key, hits);
  res.setHeader(
    "X-RateLimit-Remaining",
    String(RATE_LIMIT.limit - hits.length),
  );
  return false;
}

function logRequest(req: VercelRequest, status: number, startedAt: number) {
  console.log(
    JSON.stringify({
      level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
      route: "/api/hot",
      method: req.method ?? "GET",
      status,
      ms: Date.now() - startedAt,
    }),
  );
}

type StyleTag =
  "long-term" | "short-term" | "growth" | "dividend" | "blue-chip" | "volatile";

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
  {
    symbol: "AAPL",
    company: "Apple",
    tags: ["long-term", "blue-chip", "growth"],
  },
  {
    symbol: "MSFT",
    company: "Microsoft",
    tags: ["long-term", "blue-chip", "growth"],
  },
  {
    symbol: "GOOGL",
    company: "Alphabet",
    tags: ["long-term", "blue-chip", "growth"],
  },
  {
    symbol: "AMZN",
    company: "Amazon",
    tags: ["long-term", "growth", "volatile"],
  },
  {
    symbol: "NVDA",
    company: "NVIDIA",
    tags: ["growth", "short-term", "volatile"],
  },
  {
    symbol: "META",
    company: "Meta",
    tags: ["growth", "volatile", "short-term"],
  },
  {
    symbol: "TSLA",
    company: "Tesla",
    tags: ["short-term", "volatile", "growth"],
  },
  {
    symbol: "JPM",
    company: "JPMorgan",
    tags: ["blue-chip", "dividend", "long-term"],
  },
  { symbol: "V", company: "Visa", tags: ["long-term", "blue-chip", "growth"] },
  {
    symbol: "MA",
    company: "Mastercard",
    tags: ["long-term", "blue-chip", "growth"],
  },
  {
    symbol: "JNJ",
    company: "Johnson & Johnson",
    tags: ["dividend", "blue-chip", "long-term"],
  },
  {
    symbol: "WMT",
    company: "Walmart",
    tags: ["dividend", "blue-chip", "long-term"],
  },
  {
    symbol: "PG",
    company: "Procter & Gamble",
    tags: ["dividend", "blue-chip", "long-term"],
  },
  { symbol: "XOM", company: "Exxon Mobil", tags: ["dividend", "blue-chip"] },
  { symbol: "CVX", company: "Chevron", tags: ["dividend", "blue-chip"] },
  {
    symbol: "HD",
    company: "Home Depot",
    tags: ["blue-chip", "dividend", "long-term"],
  },
  {
    symbol: "BAC",
    company: "Bank of America",
    tags: ["dividend", "short-term"],
  },
  {
    symbol: "KO",
    company: "Coca-Cola",
    tags: ["dividend", "blue-chip", "long-term"],
  },
  {
    symbol: "PEP",
    company: "PepsiCo",
    tags: ["dividend", "blue-chip", "long-term"],
  },
  {
    symbol: "COST",
    company: "Costco",
    tags: ["long-term", "blue-chip", "growth"],
  },
  {
    symbol: "AVGO",
    company: "Broadcom",
    tags: ["growth", "dividend", "volatile"],
  },
  { symbol: "CRM", company: "Salesforce", tags: ["growth", "short-term"] },
  {
    symbol: "NFLX",
    company: "Netflix",
    tags: ["growth", "volatile", "short-term"],
  },
  { symbol: "AMD", company: "AMD", tags: ["growth", "volatile", "short-term"] },
  {
    symbol: "INTC",
    company: "Intel",
    tags: ["volatile", "short-term", "dividend"],
  },
  {
    symbol: "ORCL",
    company: "Oracle",
    tags: ["blue-chip", "growth", "dividend"],
  },
  { symbol: "CSCO", company: "Cisco", tags: ["dividend", "blue-chip"] },
  { symbol: "DIS", company: "Disney", tags: ["blue-chip", "volatile"] },
  { symbol: "NKE", company: "Nike", tags: ["blue-chip", "growth"] },
  {
    symbol: "MCD",
    company: "McDonald's",
    tags: ["dividend", "blue-chip", "long-term"],
  },
  { symbol: "ADBE", company: "Adobe", tags: ["growth", "volatile"] },
  { symbol: "IBM", company: "IBM", tags: ["dividend", "blue-chip"] },
  {
    symbol: "QCOM",
    company: "Qualcomm",
    tags: ["growth", "dividend", "volatile"],
  },
  {
    symbol: "TXN",
    company: "Texas Instruments",
    tags: ["dividend", "blue-chip", "long-term"],
  },
  {
    symbol: "UBER",
    company: "Uber",
    tags: ["growth", "short-term", "volatile"],
  },
  {
    symbol: "ABNB",
    company: "Airbnb",
    tags: ["growth", "short-term", "volatile"],
  },
  { symbol: "PYPL", company: "PayPal", tags: ["volatile", "short-term"] },
  {
    symbol: "SQ",
    company: "Block",
    tags: ["volatile", "short-term", "growth"],
  },
  {
    symbol: "SHOP",
    company: "Shopify",
    tags: ["growth", "volatile", "short-term"],
  },
  {
    symbol: "SPOT",
    company: "Spotify",
    tags: ["growth", "volatile", "short-term"],
  },
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
  const startedAt = Date.now();
  try {
    setCors(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "GET") {
      res.status(405).json({ error: "method not allowed" });
      logRequest(req, 405, startedAt);
      return;
    }
    if (rateLimited(req, res)) {
      logRequest(req, 429, startedAt);
      return;
    }

    // The client already polls this on a 5 minute cadence; let the edge serve
    // everyone in between from one upstream fetch.
    res.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=60, stale-while-revalidate=240",
    );

    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        type: "hot",
        at: Date.now(),
        intervalMs: HOT_INTERVAL_MS,
        source: "unavailable",
        stocks: [],
      });
      logRequest(req, 503, startedAt);
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
    logRequest(req, 200, startedAt);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "hot failed",
    });
    logRequest(req, 500, startedAt);
  }
}
