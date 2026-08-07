import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Fully self-contained — no relative imports (Vercel ESM cold-start crash). */

type StyleTag =
  | "long-term"
  | "short-term"
  | "growth"
  | "dividend"
  | "blue-chip"
  | "volatile";

type CategoryId = "all" | StyleTag | "gainers" | "losers";

type WatchItem = { symbol: string; company: string; tags: StyleTag[] };

type QuoteRow = {
  symbol: string;
  company: string;
  price: number;
  change: number;
  changePercent: number;
  tags: StyleTag[];
  chart?: { name: string; price: number }[];
  chartSource?: "yahoo" | "simulated";
};

const PAGE_SIZE = 10;
const yahooCache = new Map<
  string,
  { at: number; chart: { name: string; price: number }[] }
>();
const YAHOO_TTL_MS = 30 * 60 * 1000;

const CATEGORIES: { id: CategoryId; label: string; hint: string }[] = [
  { id: "all", label: "All", hint: "Full watchlist" },
  { id: "long-term", label: "Long-term", hint: "Compounders / quality holds (curated)" },
  { id: "short-term", label: "Short-term", hint: "Higher beta / tactical names (curated)" },
  { id: "growth", label: "Growth", hint: "Growth-oriented names (curated)" },
  { id: "dividend", label: "Dividend", hint: "Income / staples tilt (curated)" },
  { id: "blue-chip", label: "Blue chip", hint: "Large, established names (curated)" },
  { id: "volatile", label: "Volatile", hint: "Higher swing names (curated)" },
  { id: "gainers", label: "Day gainers", hint: "Best % change today (live)" },
  { id: "losers", label: "Day losers", hint: "Worst % change today (live)" },
];

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

const STYLE_TAGS = new Set<string>([
  "long-term",
  "short-term",
  "growth",
  "dividend",
  "blue-chip",
  "volatile",
]);

const quoteCache = new Map<string, { at: number; quote: QuoteRow }>();
const QUOTE_TTL_MS = 20_000;

function parseCategory(raw: unknown): CategoryId {
  const v = String(raw ?? "all").trim().toLowerCase();
  if (v === "all" || v === "") return "all";
  if (v === "gainers" || v === "losers") return v;
  if (STYLE_TAGS.has(v)) return v as StyleTag;
  return "all";
}

function filterWatchlist(q: string, category: CategoryId): WatchItem[] {
  const query = q.trim().toLowerCase();
  return WATCHLIST.filter((w) => {
    const textOk =
      !query ||
      w.symbol.toLowerCase().includes(query) ||
      w.company.toLowerCase().includes(query);
    if (!textOk) return false;
    if (category === "all" || category === "gainers" || category === "losers") {
      return true;
    }
    return w.tags.includes(category);
  });
}

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
  const item = WATCHLIST.find((w) => w.symbol === symbol);
  const quote: QuoteRow = {
    symbol,
    company,
    price,
    change: typeof data.d === "number" ? data.d : 0,
    changePercent: typeof data.dp === "number" ? data.dp : 0,
    tags: item?.tags ?? [],
  };
  quoteCache.set(symbol, { at: Date.now(), quote });
  return quote;
}

async function fetchMany(items: WatchItem[], token: string, concurrency = 5) {
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

type YahooPayload = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
};

async function fetchYahooSparkline(symbol: string) {
  const cached = yahooCache.get(symbol);
  if (cached && Date.now() - cached.at < YAHOO_TTL_MS) return cached.chart;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ErickMarket/1.0)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as YahooPayload;
    const result = data.chart?.result?.[0];
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
    if (!points.length) return null;
    const chart = points.slice(-20);
    yahooCache.set(symbol, { at: Date.now(), chart });
    return chart;
  } catch {
    return null;
  }
}

async function withCharts(rows: QuoteRow[]): Promise<QuoteRow[]> {
  const out: QuoteRow[] = [];
  for (let i = 0; i < rows.length; i += 4) {
    const chunk = rows.slice(i, i + 4);
    const charts = await Promise.all(
      chunk.map((r) => fetchYahooSparkline(r.symbol)),
    );
    chunk.forEach((row, idx) => {
      const chart = charts[idx];
      out.push({
        ...row,
        chart: chart ?? undefined,
        chartSource: chart ? "yahoo" : "simulated",
      });
    });
  }
  return out;
}

function mapStock(row: QuoteRow) {
  return {
    symbol: row.symbol,
    company: row.company,
    name: row.company,
    price: row.price,
    change: row.change,
    changePercent: row.changePercent,
    tags: row.tags,
    chart: row.chart,
    chartSource: row.chartSource,
  };
}

function parsePaging(req: VercelRequest) {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const category = parseCategory(req.query.category);
  const limitRaw = Number(req.query.limit ?? PAGE_SIZE);
  const offsetRaw = Number(req.query.offset ?? 0);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, Math.floor(limitRaw)), 25)
    : PAGE_SIZE;
  const offset = Number.isFinite(offsetRaw)
    ? Math.max(0, Math.floor(offsetRaw))
    : 0;
  return { q, limit, offset, category };
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

    const { q, limit, offset, category } = parsePaging(req);
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        stocks: [],
        source: "unavailable",
        error: "FINNHUB_API_KEY missing",
        total: 0,
        offset,
        limit,
        hasMore: false,
        category,
        categories: CATEGORIES,
      });
      return;
    }

    const filtered = filterWatchlist(q, category);
    const isMovers = category === "gainers" || category === "losers";

    if (isMovers) {
      const quotes = await fetchMany(filtered, apiKey);
      quotes.sort((a, b) =>
        category === "gainers"
          ? b.changePercent - a.changePercent
          : a.changePercent - b.changePercent,
      );
      const total = quotes.length;
      const page = await withCharts(quotes.slice(offset, offset + limit));
      res.status(200).json({
        stocks: page.map(mapStock),
        source: "live",
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
        q: q || undefined,
        category,
        categories: CATEGORIES,
      });
      return;
    }

    const total = filtered.length;
    const pageItems = filtered.slice(offset, offset + limit);
    const quotes = await withCharts(await fetchMany(pageItems, apiKey));
    res.status(200).json({
      stocks: quotes.map(mapStock),
      source: "live",
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
      q: q || undefined,
      category,
      categories: CATEGORIES,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "quotes failed",
    });
  }
}
