import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { getMarketQuotes } from "./quotes";

/** Minimal .env loader (no dependency) when --env-file is unavailable. */
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
      const result = await getMarketQuotes(process.env.FINNHUB_API_KEY);
      const status = result.source === "live" ? 200 : 503;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
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
  console.log(`[market-api] http://127.0.0.1:${PORT}/api/quotes`);
  if (!process.env.FINNHUB_API_KEY) {
    console.warn("[market-api] FINNHUB_API_KEY missing — /api/quotes will 503");
  }
});
