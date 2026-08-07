import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getMarketQuotes } from "../server/quotes";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  try {
    const result = await getMarketQuotes(process.env.FINNHUB_API_KEY);
    if (result.source !== "live") {
      res.status(503).json({
        stocks: [],
        source: "unavailable",
        error: "FINNHUB_API_KEY not configured or no quotes",
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
