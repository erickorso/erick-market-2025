import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { getMarketQuotesPage } from "./quotes";
import { PAGE_SIZE } from "./watchlist";

function loadDotEnv() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

const PORT = Number(process.env.MARKET_API_PORT || 4010);

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url?.startsWith("/api/quotes") && req.method === "GET") {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
      const q = url.searchParams.get("q") ?? undefined;
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? PAGE_SIZE);
      const result = await getMarketQuotesPage(process.env.FINNHUB_API_KEY, {
        q,
        offset,
        limit,
      });
      const status = result.source === "live" ? 200 : 503;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          stocks: result.quotes.map((row) => ({
            symbol: row.symbol,
            company: row.company,
            name: row.company,
            price: row.price,
            change: row.change,
            changePercent: row.changePercent,
          })),
          source: result.source,
          total: result.total,
          offset: result.offset,
          limit: result.limit,
          hasMore: result.hasMore,
          q: q || undefined,
        }),
      );
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : "quotes failed",
        }),
      );
    }
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "erick-market-api" }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[market-api] http://127.0.0.1:${PORT}/api/quotes?limit=10`);
  if (!process.env.FINNHUB_API_KEY) {
    console.warn("[market-api] FINNHUB_API_KEY missing — /api/quotes will 503");
  }
});
