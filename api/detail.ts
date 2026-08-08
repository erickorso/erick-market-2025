import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Stock detail — quote + profile2 + daily candles.
 * Self-contained (no relative imports) for Vercel ESM.
 * The CORS/rate-limit/log block below mirrors api/_lib for the same reason;
 * change it here and in api/quotes.ts and api/hot.ts together.
 */

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
      route: "/api/detail",
      method: req.method ?? "GET",
      status,
      ms: Date.now() - startedAt,
    }),
  );
}

type StyleTag =
  "long-term" | "short-term" | "growth" | "dividend" | "blue-chip" | "volatile";

const TAGS: Record<string, StyleTag[]> = {
  AAPL: ["long-term", "blue-chip", "growth"],
  MSFT: ["long-term", "blue-chip", "growth"],
  GOOGL: ["long-term", "blue-chip", "growth"],
  AMZN: ["long-term", "growth", "volatile"],
  NVDA: ["growth", "short-term", "volatile"],
  META: ["growth", "volatile", "short-term"],
  TSLA: ["short-term", "volatile", "growth"],
  JPM: ["blue-chip", "dividend", "long-term"],
  V: ["long-term", "blue-chip", "growth"],
  MA: ["long-term", "blue-chip", "growth"],
  JNJ: ["dividend", "blue-chip", "long-term"],
  WMT: ["dividend", "blue-chip", "long-term"],
  PG: ["dividend", "blue-chip", "long-term"],
  XOM: ["dividend", "blue-chip"],
  CVX: ["dividend", "blue-chip"],
  HD: ["blue-chip", "dividend", "long-term"],
  BAC: ["dividend", "short-term"],
  KO: ["dividend", "blue-chip", "long-term"],
  PEP: ["dividend", "blue-chip", "long-term"],
  COST: ["long-term", "blue-chip", "growth"],
  AVGO: ["growth", "dividend", "volatile"],
  CRM: ["growth", "short-term"],
  NFLX: ["growth", "volatile", "short-term"],
  AMD: ["growth", "volatile", "short-term"],
  INTC: ["volatile", "short-term", "dividend"],
  ORCL: ["blue-chip", "growth", "dividend"],
  CSCO: ["dividend", "blue-chip"],
  DIS: ["blue-chip", "volatile"],
  NKE: ["blue-chip", "growth"],
  MCD: ["dividend", "blue-chip", "long-term"],
  ADBE: ["growth", "volatile"],
  IBM: ["dividend", "blue-chip"],
  QCOM: ["growth", "dividend", "volatile"],
  TXN: ["dividend", "blue-chip", "long-term"],
  UBER: ["growth", "short-term", "volatile"],
  ABNB: ["growth", "short-term", "volatile"],
  PYPL: ["volatile", "short-term"],
  SQ: ["volatile", "short-term", "growth"],
  SHOP: ["growth", "volatile", "short-term"],
  SPOT: ["growth", "volatile", "short-term"],
};

type Quote = {
  c?: number;
  d?: number;
  dp?: number;
  h?: number;
  l?: number;
  o?: number;
  pc?: number;
};
type Profile = {
  name?: string;
  ticker?: string;
  exchange?: string;
  finnhubIndustry?: string;
  logo?: string;
  weburl?: string;
  marketCapitalization?: number;
  shareOutstanding?: number;
  ipo?: string;
  country?: string;
  currency?: string;
};
type Candle = {
  s?: string;
  c?: number[];
  t?: number[];
  h?: number[];
  l?: number[];
  o?: number[];
  v?: number[];
};

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

    // Profile and 3-month candles barely change intraday; only the headline
    // quote does, and the client overlays that from the polled catalog.
    res.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
    );

    const symbol = String(req.query.symbol ?? "")
      .trim()
      .toUpperCase();
    if (!symbol || !/^[A-Z.]{1,10}$/.test(symbol)) {
      res.status(400).json({ error: "invalid symbol" });
      logRequest(req, 400, startedAt);
      return;
    }

    const token = process.env.FINNHUB_API_KEY;
    if (!token) {
      res
        .status(503)
        .json({ error: "FINNHUB_API_KEY missing", source: "unavailable" });
      logRequest(req, 503, startedAt);
      return;
    }

    const to = Math.floor(Date.now() / 1000);
    const from = to - 90 * 24 * 60 * 60;
    const q = encodeURIComponent(symbol);
    const t = encodeURIComponent(token);

    const [quoteRes, profileRes, candleRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${q}&token=${t}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${q}&token=${t}`),
      fetch(
        `https://finnhub.io/api/v1/stock/candle?symbol=${q}&resolution=D&from=${from}&to=${to}&token=${t}`,
      ),
    ]);

    const quote = (await quoteRes.json()) as Quote;
    const profile = (await profileRes.json()) as Profile;
    let chart: { name: string; price: number }[] = [];
    let chartSource: "finnhub" | "yahoo" | "unavailable" = "unavailable";

    if (candleRes.ok) {
      const candle = (await candleRes.json()) as Candle;
      if (candle.s === "ok" && Array.isArray(candle.c) && candle.c.length > 0) {
        chartSource = "finnhub";
        const closes = candle.c;
        const times = candle.t ?? [];
        chart = closes.map((close, i) => {
          const ts = times[i] ? new Date(times[i] * 1000) : null;
          const name = ts
            ? `${ts.getUTCMonth() + 1}/${ts.getUTCDate()}`
            : `D-${closes.length - i}`;
          return { name, price: close };
        });
      }
    }

    if (!chart.length) {
      try {
        const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`;
        const yRes = await fetch(yUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ErickMarket/1.0)",
            Accept: "application/json",
          },
        });
        if (yRes.ok) {
          const yData = (await yRes.json()) as {
            chart?: {
              result?: Array<{
                timestamp?: number[];
                indicators?: {
                  quote?: Array<{ close?: Array<number | null> }>;
                };
              }>;
            };
          };
          const result = yData.chart?.result?.[0];
          const times = result?.timestamp ?? [];
          const closes = result?.indicators?.quote?.[0]?.close ?? [];
          const points: { name: string; price: number }[] = [];
          for (let i = 0; i < times.length; i++) {
            const close = closes[i];
            if (typeof close !== "number" || !Number.isFinite(close)) continue;
            const d = new Date(times[i] * 1000);
            points.push({
              name: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`,
              price: Number(close.toFixed(2)),
            });
          }
          if (points.length) {
            chart = points;
            chartSource = "yahoo";
          }
        }
      } catch {
        /* keep unavailable */
      }
    }

    const price = typeof quote.c === "number" ? quote.c : 0;
    if (!price) {
      res.status(404).json({ error: "quote not found", symbol });
      logRequest(req, 404, startedAt);
      return;
    }

    res.status(200).json({
      source: "live",
      chartSource,
      symbol,
      company: profile.name || symbol,
      tags: TAGS[symbol] ?? [],
      quote: {
        price,
        change: typeof quote.d === "number" ? quote.d : 0,
        changePercent: typeof quote.dp === "number" ? quote.dp : 0,
        high: typeof quote.h === "number" ? quote.h : null,
        low: typeof quote.l === "number" ? quote.l : null,
        open: typeof quote.o === "number" ? quote.o : null,
        previousClose: typeof quote.pc === "number" ? quote.pc : null,
      },
      profile: {
        exchange: profile.exchange ?? null,
        industry: profile.finnhubIndustry ?? null,
        logo: profile.logo ?? null,
        weburl: profile.weburl ?? null,
        marketCap: profile.marketCapitalization ?? null,
        sharesOutstanding: profile.shareOutstanding ?? null,
        ipo: profile.ipo ?? null,
        country: profile.country ?? null,
        currency: profile.currency ?? "USD",
      },
      chart,
    });
    logRequest(req, 200, startedAt);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "detail failed",
    });
    logRequest(req, 500, startedAt);
  }
}
