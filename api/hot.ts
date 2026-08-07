import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  CATEGORIES,
  HOT_INTERVAL_MS,
  HOT_LIMIT,
  PAGE_SIZE,
  fetchMany,
  filterWatchlist,
} from "./_lib/market";

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

    // Prefer volatile/short-term universe for "hot" to keep Finnhub calls small.
    const pool = filterWatchlist("", "volatile");
    const base = pool.length >= HOT_LIMIT ? pool : filterWatchlist("", "all");
    const quotes = await fetchMany(base, apiKey, 4);
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
