import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { WebSocketServer, type WebSocket } from "ws";
import { getMarketQuotesPage } from "./quotes";
import { PAGE_SIZE } from "./watchlist";
import { HOT_INTERVAL_MS, buildHotPayload, type HotPayload } from "./hot";

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
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const pathname = (req.url || "/").split("?")[0];
  const { handleAuthApi } = await import("./authRoutes");
  if (await handleAuthApi(req, res, pathname)) return;

  if (req.url?.startsWith("/api/quotes") && req.method === "GET") {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
      const q = url.searchParams.get("q") ?? undefined;
      const category = url.searchParams.get("category") ?? undefined;
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? PAGE_SIZE);
      const result = await getMarketQuotesPage(process.env.FINNHUB_API_KEY, {
        q,
        offset,
        limit,
        category,
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
            tags: row.tags,
            chart: row.chart,
            chartSource: row.chartSource,
            quoteSource: row.quoteSource,
          })),
          source: result.source,
          total: result.total,
          offset: result.offset,
          limit: result.limit,
          hasMore: result.hasMore,
          q: q || undefined,
          category: result.category,
          categories: result.categories,
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

  if (req.url?.startsWith("/api/hot") && req.method === "GET") {
    try {
      const payload = await buildHotPayload(process.env.FINNHUB_API_KEY);
      const status = payload.source === "live" ? 200 : 503;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : "hot failed",
        }),
      );
    }
    return;
  }

  if (req.url?.startsWith("/api/detail") && req.method === "GET") {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
      const symbol = url.searchParams.get("symbol") ?? "";
      const { getStockDetail } = await import("./detail");
      const result = await getStockDetail(process.env.FINNHUB_API_KEY, symbol);
      if ("error" in result) {
        res.writeHead(result.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : "detail failed",
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

const wss = new WebSocketServer({ server, path: "/ws/hot" });
const clients = new Set<WebSocket>();
let lastHot: HotPayload | null = null;

async function refreshHot(broadcast: boolean) {
  try {
    lastHot = await buildHotPayload(process.env.FINNHUB_API_KEY);
    if (broadcast && lastHot) {
      const msg = JSON.stringify(lastHot);
      for (const client of clients) {
        if (client.readyState === client.OPEN) client.send(msg);
      }
    }
  } catch (err) {
    console.warn(
      "[market-api] hot refresh failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

wss.on("connection", (socket) => {
  clients.add(socket);
  if (lastHot) {
    socket.send(JSON.stringify(lastHot));
  } else {
    void refreshHot(false).then(() => {
      if (lastHot && socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(lastHot));
      }
    });
  }
  socket.on("close", () => clients.delete(socket));
  socket.on("error", () => clients.delete(socket));
});

void refreshHot(false);
setInterval(() => {
  void refreshHot(true);
}, HOT_INTERVAL_MS);

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[market-api] http://127.0.0.1:${PORT}/api/quotes?limit=10`);
  console.log(
    `[market-api] ws://127.0.0.1:${PORT}/ws/hot (every ${HOT_INTERVAL_MS / 60000}m)`,
  );
  if (!process.env.FINNHUB_API_KEY) {
    console.warn("[market-api] FINNHUB_API_KEY missing — /api/quotes will 503");
  }
});
