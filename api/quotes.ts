import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  CATEGORIES,
  PAGE_SIZE,
  fetchMany,
  filterWatchlist,
  isDayMovers,
  mapStock,
  parseCategory,
} from "./_lib/market";

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

    if (isDayMovers(category)) {
      const quotes = await fetchMany(filtered, apiKey);
      quotes.sort((a, b) =>
        category === "gainers"
          ? b.changePercent - a.changePercent
          : a.changePercent - b.changePercent,
      );
      const total = quotes.length;
      const page = quotes.slice(offset, offset + limit);
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
    const page = filtered.slice(offset, offset + limit);
    const quotes = await fetchMany(page, apiKey);
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
